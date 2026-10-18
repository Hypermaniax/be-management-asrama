import assert from "node:assert/strict";
import { test } from "node:test";
import { MOUNTS, PUBLIC_PATHS, router } from "./route.ts";

type Handler = { permission?: unknown };

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: Handler }[];
  };
};

type RouterLike = { stack: RouteLayer[] };

const SELF_PATHS = new Set(["/auth/me", "/rbac/me"]);

const collect = (source: RouterLike, prefix: string) => {
  const routes: { method: string; path: string; handlers: Handler[] }[] = [];

  for (const layer of source.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({
        method: method.toUpperCase(),
        path: `${prefix}${layer.route.path}`,
        handlers: layer.route.stack.map((entry) => entry.handle),
      });
    }
  }

  return routes;
};

test("every non-public route declares a permission marker", () => {
  const routes = [
    ...collect(router as unknown as RouterLike, ""),
    ...MOUNTS.flatMap((m) => collect(m.router as unknown as RouterLike, m.prefix)),
  ];

  assert.ok(routes.length > 0, "expected to discover routes");

  const violations = routes
    .filter((route) => !PUBLIC_PATHS.has(route.path) && !SELF_PATHS.has(route.path))
    .filter((route) => !route.handlers.some((handler) => handler.permission))
    .map((route) => `${route.method} ${route.path}`);

  assert.deepEqual(violations, []);
});
