import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword } from "../../lib/password.ts";
import { createAuthService } from "./service.ts";

type Fakes = {
  findByEmail?: (email: string) => Promise<unknown>;
  create?: (data: { email: string; password?: string | null; emailVerified?: boolean }) => Promise<unknown>;
  findById?: (id: string) => Promise<unknown>;
  setEmailVerified?: (id: string) => Promise<unknown>;
  issue?: (email: string) => Promise<void>;
  verify?: (email: string, code: string) => Promise<void>;
  refreshCreate?: (userId: string, token: string, expiresAt: Date) => Promise<unknown>;
  refreshFindLive?: (token: string) => Promise<unknown>;
  refreshFindAny?: (token: string) => Promise<unknown>;
  refreshRevoke?: (id: string) => Promise<unknown>;
  refreshRevokeAll?: (userId: string) => Promise<unknown>;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  maxFailures?: number;
  windowSeconds?: number;
  now?: () => number;
};

const makeService = (fakes: Fakes = {}) => {
  const users = {
    findByEmail: fakes.findByEmail ?? (async () => null),
    create:
      fakes.create ??
      (async (data: { email: string; password?: string | null }) => ({
        id: "u1",
        email: data.email,
        password: data.password ?? null,
        emailVerified: false,
        createdAt: new Date(),
      })),
    findById: fakes.findById ?? (async () => null),
    setEmailVerified:
      fakes.setEmailVerified ??
      (async (id: string) => ({
        id,
        email: "a@b.com",
        password: null,
        emailVerified: true,
        createdAt: new Date(),
      })),
  };
  const otp = {
    issue: fakes.issue ?? (async () => {}),
    verify: fakes.verify ?? (async () => {}),
  };
  const refreshRepo = {
    create: fakes.refreshCreate ?? (async () => ({})),
    findLive: fakes.refreshFindLive ?? (async () => null),
    findAny: fakes.refreshFindAny ?? (async () => null),
    revoke: fakes.refreshRevoke ?? (async () => ({})),
    revokeAllForUser: fakes.refreshRevokeAll ?? (async () => ({})),
  };
  return createAuthService({
    users,
    otp,
    refreshRepo,
    accessTtlSeconds: fakes.accessTtlSeconds,
    refreshTtlSeconds: fakes.refreshTtlSeconds,
    maxFailures: fakes.maxFailures,
    windowSeconds: fakes.windowSeconds,
    now: fakes.now,
  } as never);
};

test("signUp normalizes email, issues OTP, and returns no token", async () => {
  const issued: string[] = [];
  const service = makeService({ issue: async (email) => void issued.push(email) });

  const result = await service.signUp("MixedCase@Example.com", "password123");

  assert.deepEqual(issued, ["mixedcase@example.com"]);
  assert.equal("token" in result, false);
  assert.equal(result.user.email, "mixedcase@example.com");
});

test("signUp maps a unique violation (P2002) to 409", async () => {
  const service = makeService({
    create: async () => {
      throw Object.assign(new Error("dup"), { code: "P2002" });
    },
  });

  await assert.rejects(
    () => service.signUp("a@b.com", "password123"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("signIn rejects unverified email with 403", async () => {
  const password = await hashPassword("password123");
  const service = makeService({
    findByEmail: async () => ({
      id: "u1",
      email: "a@b.com",
      password,
      emailVerified: false,
      createdAt: new Date(),
    }),
  });

  await assert.rejects(
    () => service.signIn("a@b.com", "password123"),
    (err: { status?: number }) => err.status === 403,
  );
});

test("signIn locks an account after 5 failed attempts even with correct password", async () => {
  const service = makeService({
    findByEmail: async (email: string) => ({
      id: "u1",
      email,
      password: await hashPassword("correctpassword"),
      emailVerified: true,
      deletedAt: null,
    }),
    maxFailures: 5,
  });

  for (let i = 0; i < 5; i++) {
    await assert.rejects(service.signIn("a@b.com", "wrongpassword"), { status: 401 });
  }
  await assert.rejects(service.signIn("a@b.com", "correctpassword"), { status: 429 });
});

test("signIn clears the failure counter after a successful login", async () => {
  let calls = 0;
  const service = makeService({
    findByEmail: async (email: string) => {
      calls++;
      return {
        id: "u1",
        email,
        password: await hashPassword("correctpassword"),
        emailVerified: true,
        deletedAt: null,
      };
    },
    maxFailures: 5,
  });

  await service.signIn("a@b.com", "correctpassword");
  await service.signIn("a@b.com", "correctpassword");
  assert.equal(calls, 2);
});

test("lockout window slides per account, emails are independent", async () => {
  let at = 0;
  const verified = {
    id: "u1",
    email: "a@b.com",
    password: "hash",
    emailVerified: true,
    deletedAt: null,
  };
  const service = makeService({
    findByEmail: async () => verified,
    maxFailures: 3,
    now: () => at,
  });

  await assert.rejects(service.signIn("a@b.com", "x"), { status: 401 });
  await assert.rejects(service.signIn("a@b.com", "x"), { status: 401 });
  await assert.rejects(service.signIn("a@b.com", "x"), { status: 401 });
  await assert.rejects(service.signIn("a@b.com", "x"), { status: 429 });
  await assert.rejects(service.signIn("b@b.com", "x"), { status: 401 });
  at = 15 * 60 * 1000 + 1;
  await assert.rejects(service.signIn("a@b.com", "x"), { status: 401 });
});

test("refreshSession rotates the pair and rejects the old token", async () => {
  const revoked: string[] = [];
  let nextId = 1;
  let nextUserId = "u1";
  // Registry of live rows: token → { id, revokedAt }
  const rows = new Map([["living1", { id: "rt1", revokedAt: null as Date | null }]]);
  const service = makeService({
    findById: async () => ({ id: "u1", email: "a@b.com" }),
    refreshFindAny: async (token: string) => {
      const row = rows.get(token);
      return row ? { id: row.id, userId: nextUserId, revokedAt: row.revokedAt } : null;
    },
    refreshFindLive: async (token: string) => {
      const row = rows.get(token);
      return row && !row.revokedAt ? { id: row.id, userId: nextUserId } : null;
    },
    refreshRevoke: async (id: string) => {
      revoked.push(id);
      for (const row of rows.values()) {
        if (row.id === id) {
          row.revokedAt = new Date();
        }
      }
    },
    refreshCreate: async (userId: string, token: string) => {
      nextUserId = userId;
      rows.set(token, { id: `rt${++nextId}`, revokedAt: null });
    },
  });

  const rotated = await service.refreshSession("living1");
  assert.deepEqual(revoked, ["rt1"]);
  assert.ok(rotated.refreshToken && rotated.refreshToken !== "living1");

  // Replay of the revoked token → theft containment
  revoked.length = 0;
  await assert.rejects(service.refreshSession("living1"), { status: 401 });
  assert.deepEqual(revoked, []);
});

test("refreshSession revokes everything when a revoked token is replayed", async () => {
  const revokedAll: string[] = [];
  const service = makeService({
    refreshFindAny: async (token: string) =>
      token === "revoked" ? { id: "rt2", userId: "u9", revokedAt: new Date() } : null,
    refreshRevokeAll: async (userId: string) => {
      revokedAll.push(userId);
    },
  });

  await assert.rejects(service.refreshSession("revoked"), { status: 401 });
  assert.deepEqual(revokedAll, ["u9"]);
});

test("logout revokes a live token and ignores unknown tokens", async () => {
  const revoked: string[] = [];
  const service = makeService({
    refreshFindLive: async (token: string) => (token === "living" ? { id: "rt3", userId: "u1" } : null),
    refreshRevoke: async (id: string) => {
      revoked.push(id);
    },
  });

  const result = await service.logout("living");
  await service.logout("ghost");
  assert.deepEqual(revoked, ["rt3"]);
  assert.deepEqual(result, { loggedOut: true });
});
