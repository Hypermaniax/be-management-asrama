import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOtp } from "../../lib/otp.ts";
import { createOtpService } from "./service.ts";

const SECRET = "test-secret";
const TTL = 300;

const setup = (startAt = 0) => {
  let current = startAt;
  const sent: Array<{ email: string; code: string }> = [];
  const service = createOtpService({
    secret: SECRET,
    ttlSeconds: TTL,
    send: (email, code) => void sent.push({ email, code }),
    now: () => current,
  });
  return {
    service,
    sent,
    advance: (seconds: number) => {
      current += seconds * 1000;
    },
  };
};

test("generateOtp is deterministic and 6 digits", () => {
  const a = generateOtp(SECRET, "a@b.com", 1);
  const b = generateOtp(SECRET, "a@b.com", 1);
  assert.equal(a, b);
  assert.match(a, /^\d{6}$/);
});

test("issue derives the code for the current step and sends it", async () => {
  const { service, sent } = setup();
  await service.issue("User@Example.com");

  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.email, "user@example.com");
  assert.equal(sent[0]!.code, generateOtp(SECRET, "user@example.com", 0));
});

test("verify accepts the code issued for the current step", async () => {
  const { service, sent } = setup();
  await service.issue("a@b.com");

  await service.verify("a@b.com", sent[0]!.code);
});

test("verify accepts the previous step within the grace window", async () => {
  const { service, sent, advance } = setup();
  await service.issue("a@b.com");
  advance(TTL + 1);

  await service.verify("a@b.com", sent[0]!.code);
});

test("verify rejects a wrong code", async () => {
  const { service } = setup();
  await service.issue("a@b.com");

  await assert.rejects(
    () => service.verify("a@b.com", "000000"),
    (err: { status?: number }) => err.status === 400,
  );
});

test("verify rejects a code older than the grace window", async () => {
  const { service, sent, advance } = setup();
  await service.issue("a@b.com");
  advance(TTL * 2 + 1);

  await assert.rejects(
    () => service.verify("a@b.com", sent[0]!.code),
    (err: { status?: number }) => err.status === 400,
  );
});

test("verify rejects replaying the same code", async () => {
  const { service, sent } = setup();
  await service.issue("a@b.com");
  await service.verify("a@b.com", sent[0]!.code);

  await assert.rejects(
    () => service.verify("a@b.com", sent[0]!.code),
    (err: { status?: number }) => err.status === 400,
  );
});
