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
  return createAuthService({ users, otp } as never);
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
