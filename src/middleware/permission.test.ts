import assert from "node:assert/strict";
import { test } from "node:test";
import type { Access } from "../services/rbac/service.ts";
import { requirePermission } from "./permission.ts";

const access = (over: Partial<Access> = {}): Access => ({
  roles: [],
  permissions: new Set(),
  buildings: new Set(),
  isSuperAdmin: false,
  menus: [],
  ...over,
});

const run = (a: Access, resource: string, action: "READ" | "CREATE" | "DELETE") => {
  let nextCalled = false;
  const req = { access: a } as never;
  const next = () => {
    nextCalled = true;
  };

  try {
    requirePermission(resource, action)(req, {} as never, next as never);
    return { error: null as { status?: number } | null, nextCalled };
  } catch (err) {
    return { error: err as { status?: number }, nextCalled };
  }
};

test("requirePermission returns 403 when the permission is missing", () => {
  const { error, nextCalled } = run(access(), "role", "READ");

  assert.equal(error?.status, 403);
  assert.equal(nextCalled, false);
});

test("requirePermission passes when the permission is present", () => {
  const { error, nextCalled } = run(access({ permissions: new Set(["role.read"]) }), "role", "READ");

  assert.equal(error, null);
  assert.equal(nextCalled, true);
});

test("requirePermission lets SUPER_ADMIN bypass every check", () => {
  const { error, nextCalled } = run(access({ roles: ["SUPER_ADMIN"], isSuperAdmin: true }), "role", "DELETE");

  assert.equal(error, null);
  assert.equal(nextCalled, true);
});
