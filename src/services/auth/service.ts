import { normalizeEmail } from "../../lib/email.ts";
import { AppError } from "../../lib/errors.ts";
import { signToken } from "../../lib/jwt.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import type { UserRepository } from "../../repositories/users.ts";
import { newRefreshToken } from "../../repositories/refreshTokens.ts";
import type { OtpService } from "../otp/service.ts";

export type RefreshTokenRepository = {
  create(userId: string, token: string, expiresAt: Date): Promise<unknown>;
  findLive(token: string): Promise<{ id: string; userId: string } | null>;
  findAny(token: string): Promise<{ id: string; userId: string; revokedAt: Date | null } | null>;
  revoke(id: string): Promise<unknown>;
  revokeAllForUser(userId: string): Promise<unknown>;
};

type AuthDeps = {
  users: UserRepository;
  otp: OtpService;
  assignResidentRole?: (userId: string) => Promise<void>;
  refreshRepo: RefreshTokenRepository;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  maxFailures?: number;
  windowSeconds?: number;
  now?: () => number;
};

const toPublicUser = (user: { id: string; email: string }) => {
  return { id: user.id, email: user.email };
};

export const createAuthService = ({
  users,
  otp,
  assignResidentRole,
  refreshRepo,
  accessTtlSeconds,
  refreshTtlSeconds,
  maxFailures,
  windowSeconds,
  now = Date.now,
}: AuthDeps) => {
  // Per-account lockout: after N failed sign-ins for one email within a window,
  // further attempts are rejected until the window slides past the last failure.
  const limitedAccessTtl = accessTtlSeconds ?? 3600;
  const limitedRefreshTtl = refreshTtlSeconds ?? 60 * 60 * 24 * 30;
  const failureLimit = maxFailures ?? 5;
  const failureWindowMs = (windowSeconds ?? 900) * 1000;
  const failures = new Map<string, { count: number; lastAt: number }>();

  const assertNotLocked = (email: string) => {
    const entry = failures.get(email);
    if (!entry) {
      return;
    }
    if (now() - entry.lastAt > failureWindowMs) {
      failures.delete(email);
      return;
    }
    if (entry.count >= failureLimit) {
      throw new AppError("Too many failed attempts, try again later", 429);
    }
  };

  const recordFailure = (email: string) => {
    const entry = failures.get(email);
    const at = now();
    if (!entry || at - entry.lastAt > failureWindowMs) {
      failures.set(email, { count: 1, lastAt: at });
      return;
    }
    entry.count += 1;
    entry.lastAt = at;
  };

  const issueSession = async (user: { id: string; email: string }) => {
    const token = signToken({ sub: user.id, email: user.email });
    const refreshToken = newRefreshToken();
    const expiresAt = new Date(now() + limitedRefreshTtl * 1000);
    await refreshRepo.create(user.id, refreshToken, expiresAt);
    return { user: toPublicUser(user), token, refreshToken };
  };

  const isUniqueViolation = (err: unknown) => {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
  };

  return {
    async signUp(email: string, password: string) {
      const normalized = normalizeEmail(email);
      if (await users.findByEmail(normalized)) {
        throw new AppError("Email already registered", 409);
      }

      const hashed = await hashPassword(password);
      let user;
      try {
        user = await users.create({ email: normalized, password: hashed, status: "PENDING" });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new AppError("Email already registered", 409);
        }
        throw err;
      }

      await assignResidentRole?.(user.id);
      await otp.issue(normalized);
      return { user: toPublicUser(user) };
    },

    async signIn(email: string, password: string) {
      const normalized = normalizeEmail(email);
      assertNotLocked(normalized);

      const user = await users.findByEmail(normalized);
      if (!user || !user.password || !(await verifyPassword(password, user.password))) {
        recordFailure(normalized);
        throw new AppError("Invalid email or password", 401);
      }
      if (!user.emailVerified) {
        throw new AppError("Email not verified", 403);
      }

      failures.delete(normalized);
      return issueSession(user);
    },

    async refreshSession(refreshToken: string) {
      const existing = await refreshRepo.findAny(refreshToken);
      if (!existing) {
        throw new AppError("Invalid refresh token", 401);
      }
      if (existing.revokedAt) {
        // A revoked token being replayed means the token was stolen: contain it.
        await refreshRepo.revokeAllForUser(existing.userId);
        throw new AppError("Invalid refresh token", 401);
      }
      const live = await refreshRepo.findLive(refreshToken);
      if (!live) {
        throw new AppError("Invalid or expired refresh token", 401);
      }

      const user = await users.findById(live.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      await refreshRepo.revoke(live.id);
      return issueSession(user);
    },

    async logout(refreshToken: string) {
      const live = await refreshRepo.findLive(refreshToken);
      if (live) {
        await refreshRepo.revoke(live.id);
      }
      return { loggedOut: true };
    },

    async me(userId: string) {
      const user = await users.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      return toPublicUser(user);
    },

    async requestOTP(email: string) {
      await otp.issue(email);
      return { sent: true };
    },

    async verifyOTP(email: string, code: string) {
      const normalized = normalizeEmail(email);
      await otp.verify(normalized, code);

      const user = await users.findByEmail(normalized);
      if (!user) {
        throw new AppError("Invalid or expired OTP", 400);
      }

      if (!user.emailVerified) {
        await users.setEmailVerified(user.id);
      }

      return { verified: true, ...(await issueSession(user)) };
    },
  };
};

export type AuthService = ReturnType<typeof createAuthService>;
