import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAuditMeta } from "./audit.ts";

const withMarker = (resource: string, action: string) => ({
  stack: [{ handle: { permission: { resource, action } } }],
});

test("resolveAuditMeta uses the route permission marker", () => {
  const meta = resolveAuditMeta({
    method: "POST",
    path: "/elections",
    route: withMarker("election", "CREATE"),
  });

  assert.deepEqual(meta, { action: "CREATE", entity: "election" });
});

test("resolveAuditMeta maps a DYNAMIC marker to the HTTP method", () => {
  const meta = resolveAuditMeta({
    method: "PATCH",
    path: "/rooms/123",
    route: withMarker("room", "DYNAMIC"),
  });

  assert.deepEqual(meta, { action: "UPDATE", entity: "room" });
});

test("resolveAuditMeta falls back to the method and first path segment", () => {
  const meta = resolveAuditMeta({ method: "DELETE", path: "/occupancies/123" });

  assert.deepEqual(meta, { action: "DELETE", entity: "occupancies" });
});

test("resolveAuditMeta defaults to CREATE for POST without a marker", () => {
  const meta = resolveAuditMeta({ method: "POST", path: "/events/1/sessions" });

  assert.equal(meta.action, "CREATE");
  assert.equal(meta.entity, "events");
});
