import { normalizeEmail } from "../../lib/email.ts";
import { AppError } from "../../lib/errors.ts";
import { signToken } from "../../lib/jwt.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import type { UserRepository } from "../../repositories/users.ts";
import type { OtpService } from "../otp/service.ts";

type AuthDeps = {
  users: UserRepository;
  otp: OtpService;
  assignResidentRole?: (userId: string) => Promise<void>;
};

const toPublicUser = (user: { id: string; email: string }) => {
  return { id: user.id, email: user.email };
};

const issueSession = (user: { id: string; email: string }) => {
  return {
    user: toPublicUser(user),
    token: signToken({ sub: user.id, email: user.email }),
  };
};

const isUniqueViolation = (err: unknown) => {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
};

export const createAuthService = ({ users, otp, assignResidentRole }: AuthDeps) => ({
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
    const user = await users.findByEmail(normalizeEmail(email));
    if (!user || !user.password || !(await verifyPassword(password, user.password))) {
      throw new AppError("Invalid email or password", 401);
    }
    if (!user.emailVerified) {
      throw new AppError("Email not verified", 403);
    }

    return issueSession(user);
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

    return { verified: true, ...issueSession(user) };
  },
});

export type AuthService = ReturnType<typeof createAuthService>;
