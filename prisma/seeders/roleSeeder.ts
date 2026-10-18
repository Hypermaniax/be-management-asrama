import type { PermissionAction } from "../../src/generated/prisma/client.ts";
import { permissionCode } from "../../src/lib/permission.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ALL_MENU_CODES } from "./menuSeeder.ts";

export type RoleSeed = { code: string; name: string; isSystem?: boolean };

export const ROLES: RoleSeed[] = [
  { code: "SUPER_ADMIN", name: "Admin Master", isSystem: true },
  { code: "ADMIN_GEDUNG", name: "Admin Gedung" },
  { code: "PENGHUNI", name: "Warga" },
  { code: "CALON_PENGHUNI", name: "Calon Penghuni" },
];

export const ROLE_PERMISSIONS: Record<string, Partial<Record<string, PermissionAction[]>>> = {
  ADMIN_GEDUNG: {
    building: ["READ"],
    room: ["CREATE", "READ", "UPDATE", "DELETE"],
    feeRule: ["CREATE", "READ", "UPDATE", "DELETE"],
    facility: ["CREATE", "READ", "UPDATE", "DELETE"],
    occupancy: ["CREATE", "READ", "UPDATE", "DELETE"],
    document: ["READ", "VERIFY"],
    invoice: ["CREATE", "READ", "UPDATE", "DELETE"],
    payment: ["CREATE", "READ", "UPDATE", "DELETE"],
    cash: ["CREATE", "READ", "UPDATE", "DELETE"],
    report: ["READ", "EXPORT"],
    user: ["READ"],
    position: ["CREATE", "READ", "UPDATE", "DELETE"],
    period: ["READ"],
    event: ["CREATE", "READ", "UPDATE", "DELETE"],
    election: ["READ"],
  },
  PENGHUNI: {
    invoice: ["READ"],
    payment: ["READ"],
    document: ["CREATE", "READ"],
    event: ["READ"],
    election: ["READ"],
  },
  CALON_PENGHUNI: {
    document: ["CREATE", "READ"],
  },
};

export const ROLE_MENUS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_MENU_CODES,
  ADMIN_GEDUNG: ALL_MENU_CODES.filter(
    (code) =>
      code !== "system" &&
      !code.startsWith("system.") &&
      !["me.invoice", "me.document", "me.attendance", "me.election"].includes(code),
  ),
  PENGHUNI: [
    "dashboard",
    "event.list",
    "event.session",
    "event.attendance",
    "election.list",
    "election.result",
    "me.profile",
    "me.invoice",
    "me.document",
    "me.attendance",
    "me.election",
  ],
  CALON_PENGHUNI: ["dashboard", "me.profile", "me.document"],
};

type SeedRolesInput = {
  menuIds: Map<string, string>;
  permissionIds: Map<string, string>;
};

export async function seedRoles({ menuIds, permissionIds }: SeedRolesInput) {
  const roleIds = new Map<string, string>();

  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        isSystem: role.isSystem ?? false,
      },
      update: { name: role.name, isSystem: role.isSystem ?? false },
    });
    roleIds.set(role.code, created.id);
  }

  for (const role of ROLES) {
    const roleId = roleIds.get(role.code);
    if (!roleId) continue;

    const permissionCodes =
      role.code === "SUPER_ADMIN"
        ? [...permissionIds.keys()]
        : Object.entries(ROLE_PERMISSIONS[role.code] ?? {}).flatMap(([resource, actions]) =>
            (actions ?? []).map((action) => permissionCode(resource, action)),
          );

    const permissionIdList = permissionCodes
      .map((code) => permissionIds.get(code))
      .filter((id): id is string => Boolean(id));

    const menuIdList = (ROLE_MENUS[role.code] ?? [])
      .map((code) => menuIds.get(code))
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIdList.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
      prisma.roleMenu.deleteMany({ where: { roleId } }),
      prisma.roleMenu.createMany({
        data: menuIdList.map((menuId) => ({ roleId, menuId })),
        skipDuplicates: true,
      }),
    ]);

    console.log(
      `seeded role ${role.code}: ${permissionIdList.length} permissions, ${menuIdList.length} menus`,
    );
  }

  return roleIds;
}
