import assert from "node:assert/strict";
import { test } from "node:test";
import { createRbacService } from "./service.ts";

type Assignment = {
  buildingId: string | null;
  role: {
    code: string;
    permissions: { permission: { code: string } }[];
    menus: { menu: Record<string, unknown> }[];
  };
};

type Fakes = {
  findByCode?: (code: string) => Promise<unknown>;
  findById?: (id: string) => Promise<unknown>;
  listByUserWithPermissions?: (userId: string) => Promise<Assignment[]>;
  listByUser?: (userId: string) => Promise<{ role: { code: string } }[]>;
  listPermissions?: () => Promise<unknown>;
  listMenus?: () => Promise<unknown>;
  rolePermissionListForRole?: (roleId: string) => Promise<{ permissionId: string }[]>;
  roleMenuListForRole?: (roleId: string) => Promise<{ menuId: string }[]>;
  findUserById?: (id: string) => Promise<unknown>;
  listOverrides?: (userId: string) => Promise<{ permissionId: string; permission: { code: string }; effect: string }[]>;
  replaceOverrides?: (userId: string, overrides: unknown[]) => Promise<unknown>;
};

const menu = (over: Record<string, unknown>) => ({
  id: "m",
  parentId: null,
  code: "me",
  name: "Akun Saya",
  path: "#",
  icon: null,
  sortOrder: 1,
  isActive: true,
  deletedAt: null,
  ...over,
});

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    users: {
      findById: fakes.findUserById ?? (async () => null),
    },
    roles: {
      findByCode: fakes.findByCode ?? (async () => null),
      findById: fakes.findById ?? (async () => null),
      list: async () => [],
      create: async (data: Record<string, unknown>) => ({ id: "r1", ...data }),
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id }),
    },
    permissions: {
      list: fakes.listPermissions ?? (async () => []),
    },
    menus: {
      list: fakes.listMenus ?? (async () => []),
    },
    userRoles: {
      assign: async (data: Record<string, unknown>) => ({ id: "ur1", ...data }),
      remove: async (id: string) => ({ id }),
      listByUser: fakes.listByUser ?? (async () => []),
      listByUserWithPermissions: fakes.listByUserWithPermissions ?? (async () => []),
    },
    rolePermissions: {
      replaceForRole: async () => {},
      listForRole: fakes.rolePermissionListForRole ?? (async () => []),
    },
    roleMenus: {
      replaceForRole: async () => {},
      listForRole: fakes.roleMenuListForRole ?? (async () => []),
    },
    permissionOverrides: {
      listForUser: fakes.listOverrides ?? (async () => []) as never,
      replaceForUser: fakes.replaceOverrides ?? (async () => ({})),
    },
  };
  return createRbacService(deps as never);
};

test("createRole rejects a duplicate code with 409", async () => {
  const service = makeService({ findByCode: async () => ({ id: "r1", code: "X" }) });

  await assert.rejects(
    () => service.createRole({ code: "X", name: "X" }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("softDeleteRole rejects a system role with 400", async () => {
  const service = makeService({
    findById: async () => ({ id: "r1", code: "SUPER_ADMIN", isSystem: true }),
  });

  await assert.rejects(
    () => service.softDeleteRole("r1"),
    (err: { status?: number }) => err.status === 400,
  );
});

test("resolveAccess merges permissions, menus and buildings across roles", async () => {
  const service = makeService({
    listByUserWithPermissions: async () => [
      {
        buildingId: null,
        role: {
          code: "PENGHUNI",
          permissions: [{ permission: { code: "invoice.read" } }],
          menus: [{ menu: menu({ id: "m1", code: "me" }) }],
        },
      },
      {
        buildingId: "b1",
        role: {
          code: "ADMIN_GEDUNG",
          permissions: [{ permission: { code: "room.read" } }],
          menus: [
            {
              menu: menu({
                id: "m2",
                parentId: "m1",
                code: "me.profile",
                name: "Profil Saya",
                path: "/me/profile",
              }),
            },
          ],
        },
      },
    ],
  });

  const access = await service.resolveAccess("u1");

  assert.deepEqual([...access.permissions].sort(), ["invoice.read", "room.read"]);
  assert.deepEqual(access.roles.sort(), ["ADMIN_GEDUNG", "PENGHUNI"]);
  assert.deepEqual([...access.buildings], ["b1"]);
  assert.equal(access.isSuperAdmin, false);
  assert.equal(access.menus.length, 1);
  assert.equal(access.menus[0]?.children.length, 1);
});

test("resolveAccess flags SUPER_ADMIN and drops inactive menus", async () => {
  const service = makeService({
    listByUserWithPermissions: async () => [
      {
        buildingId: null,
        role: {
          code: "SUPER_ADMIN",
          permissions: [],
          menus: [
            { menu: menu({ id: "m1" }) },
            { menu: menu({ id: "m2", code: "me.hidden", isActive: false }) },
          ],
        },
      },
    ],
  });

  const access = await service.resolveAccess("u1");

  assert.equal(access.isSuperAdmin, true);
  assert.deepEqual(access.menus.map((node) => node.id), ["m1"]);
});

test("listPermissions and listMenus expose the directive tables", async () => {
  const service = makeService({
    listPermissions: async () => [{ id: "p1", code: "room.READ", resource: "room", action: "READ" }],
    listMenus: async () => [{ id: "m1", code: "me", name: "Akun Saya" }],
  });

  assert.deepEqual(await service.listPermissions(), [{ id: "p1", code: "room.READ", resource: "room", action: "READ" }]);
  assert.deepEqual(await service.listMenus(), [{ id: "m1", code: "me", name: "Akun Saya" }]);
});

test("getRolePermissions/getRoleMenus return current ids and reject unknown roles", async () => {
  const service = makeService({
    findById: async (id: string) => (id === "r1" ? { id: "r1", code: "X" } : null),
    rolePermissionListForRole: async () => [{ permissionId: "p1" }, { permissionId: "p2" }],
    roleMenuListForRole: async () => [{ menuId: "m1" }],
  });

  assert.deepEqual(await service.getRolePermissions("r1"), { roleId: "r1", permissionIds: ["p1", "p2"] });
  assert.deepEqual(await service.getRoleMenus("r1"), { roleId: "r1", menuIds: ["m1"] });
  await assert.rejects(service.getRolePermissions("nope"), { status: 404 });
  await assert.rejects(service.getRoleMenus("nope"), { status: 404 });
});

const overrideFixtures = () => makeService({
  listByUserWithPermissions: async () => [
    {
      buildingId: null,
      role: {
        code: "PENGHUNI",
        permissions: [{ permission: { code: "invoice.read" } }, { permission: { code: "report.read" } }],
        menus: [{ menu: menu({ id: "m1", code: "me" }) }],
      },
    },
  ],
  listOverrides: async () => [
    { permissionId: "p1", permission: { code: "report.read" }, effect: "DENY" },
    { permissionId: "p2", permission: { code: "cash.read" }, effect: "GRANT" },
  ],
});

test("resolveAccess applies per-user overrides: DENY removes, GRANT adds", async () => {
  const service = overrideFixtures();

  const access = await service.resolveAccess("u1");

  assert.deepEqual([...access.permissions].sort(), ["cash.read", "invoice.read"]);
  assert.equal(access.permissions.has("report.read"), false);
});

const superAdmin = (id: string) => makeService({
  findUserById: async () => ({ id, email: "x@y.com" }),
  listByUser: async () => [{ role: { code: "SUPER_ADMIN" } }],
  listByUserWithPermissions: async () => [
    {
      buildingId: null,
      role: { code: "SUPER_ADMIN", permissions: [{ permission: { code: "all" } }], menus: [] },
    },
  ],
  listOverrides: async () => [],
});
test("setPermissionOverrides validates unknown ids, duplicates and super admin", async () => {
  const directive = [
    { id: "p1", code: "a.A", resource: "a", action: "READ" },
    { id: "p2", code: "b.B", resource: "b", action: "READ" },
  ];
  const service = makeService({
    findUserById: async () => ({ id: "u1", email: "x@y.com" }),
    listPermissions: async () => directive,
    listByUser: async () => [{ role: { code: "PENGHUNI" } }, { role: { code: "ADMIN_GEDUNG" } }],
    replaceOverrides: async (userId: string, overrides: unknown[]) => {
      assert.deepEqual([...overrides], [
        { permissionId: "p1", effect: "GRANT" },
        { permissionId: "p2", effect: "DENY" },
      ]);
    },
  } as never);

  await assert.rejects(
    service.setPermissionOverrides("u1", [{ permissionId: "ghost", effect: "GRANT" } as never]),
    { status: 400, message: "Unknown permission id" },
  );
  await assert.rejects(
    service.setPermissionOverrides("u1", [
      { permissionId: "p1", effect: "GRANT" } as never,
      { permissionId: "p1", effect: "DENY" } as never,
    ]),
    { status: 400, message: "Duplicate permission in overrides" },
  );

  const result = await service.setPermissionOverrides("u1", [
    { permissionId: "p1", effect: "GRANT" } as never,
    { permissionId: "p2", effect: "DENY" } as never,
  ]);
  assert.equal(result.userId, "u1");
});

test("setPermissionOverrides refuses a super admin user", async () => {
  const service = superAdmin("u9");
  void service;

  await assert.rejects(
    service.setPermissionOverrides("u9", []),
    { status: 409, message: "Super admin access cannot be overridden" },
  );
});

test("getPermissionOverrides rejects unknown user", async () => {
  const service = makeService({});

  await assert.rejects(service.getPermissionOverrides("ghost"), { status: 404 });
});

test("getPermissionOverrides groups grants and denies", async () => {
  const service = makeService({
    findUserById: async () => ({ id: "u1", email: "x@y.com" }),
    listByUser: async () => [],
    listOverrides: async () => [
      { permissionId: "p2", permission: { code: "cash.read" }, effect: "GRANT" },
      { permissionId: "p1", permission: { code: "report.read" }, effect: "DENY" },
    ],
  });

  const data = await service.getPermissionOverrides("u1");
  assert.deepEqual(data.grants, [{ permissionId: "p2", code: "cash.read" }]);
  assert.deepEqual(data.denies, [{ permissionId: "p1", code: "report.read" }]);
});
