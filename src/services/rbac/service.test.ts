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
    roles: {
      findByCode: fakes.findByCode ?? (async () => null),
      findById: fakes.findById ?? (async () => null),
      list: async () => [],
      create: async (data: Record<string, unknown>) => ({ id: "r1", ...data }),
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id }),
    },
    permissions: {},
    menus: {},
    userRoles: {
      assign: async (data: Record<string, unknown>) => ({ id: "ur1", ...data }),
      remove: async (id: string) => ({ id }),
      listByUserWithPermissions: fakes.listByUserWithPermissions ?? (async () => []),
    },
    rolePermissions: { replaceForRole: async () => {} },
    roleMenus: { replaceForRole: async () => {} },
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
