import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuditService } from "./service.ts";

const makeService = (overrides: { findById?: unknown } = {}) => {
  const recorded: Record<string, unknown>[] = [];

  const deps = {
    audit: {
      record: async (data: Record<string, unknown>) => {
        recorded.push(data);
        return { id: "log1", ...data };
      },
      list: async () => [],
      findById: async () =>
        overrides.findById === undefined ? { id: "log1" } : overrides.findById,
    },
  };

  return { service: createAuditService(deps as never), recorded };
};

test("record redacts sensitive fields before persisting", async () => {
  const { service, recorded } = makeService();

  await service.record({
    actorId: "u1",
    action: "UPDATE",
    entity: "user",
    entityId: "u2",
    after: { email: "a@b.c", password: "secret", nested: { token: "abc" } },
  });

  const after = recorded[0].after as Record<string, unknown>;
  assert.equal(after.password, "[redacted]");
  assert.equal((after.nested as Record<string, unknown>).token, "[redacted]");
  assert.equal(after.email, "a@b.c");
});

test("record passes through a non-object payload unchanged", async () => {
  const { service, recorded } = makeService();

  await service.record({
    actorId: "u1",
    action: "DELETE",
    entity: "role",
    entityId: "r1",
    before: null,
  });

  assert.equal(recorded[0].before, null);
});

test("getById rejects a missing log with 404", async () => {
  const { service } = makeService({ findById: null });

  await assert.rejects(
    () => service.getById("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});
