import type { PermissionAction } from "../../src/generated/prisma/client.ts";
import { permissionCode } from "../../src/lib/permission.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ALL_MENU_CODES } from "./menuSeeder.ts";
import { requireId } from "./utils.ts";

export type RoleSeed = {
  code: string;
  name: string;
  description: string;
  isSystem?: boolean;
};

export const ROLES: RoleSeed[] = [
  {
    code: "SUPER_ADMIN",
    name: "Admin Master",
    description: "Akses penuh ke seluruh sistem dan semua gedung",
    isSystem: true,
  },
  {
    code: "ADMIN_GEDUNG",
    name: "Admin Gedung",
    description: "Mengelola penghuni, kamar, tagihan, dan kas gedungnya",
  },
  {
    code: "BENDAHARA",
    name: "Bendahara",
    description: "Mengelola tagihan, pembayaran, pengeluaran, dan kas gedungnya",
  },
  {
    code: "PENGURUS",
    name: "Pengurus",
    description: "Role dasar pengurus: kegiatan, pemilihan, dan pengeluaran",
  },
  { code: "PENGHUNI", name: "Warga", description: "Penghuni asrama: tagihan, pembayaran, absensi" },
  {
    code: "CALON_PENGHUNI",
    name: "Calon Penghuni",
    description: "Pendaftar: unggah dokumen dan profil",
  },
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
    payment: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    cash: ["CREATE", "READ", "UPDATE", "DELETE"],
    report: ["READ", "EXPORT"],
    user: ["READ"],
    position: ["CREATE", "READ", "UPDATE", "DELETE"],
    period: ["READ"],
    event: ["CREATE", "READ", "UPDATE", "DELETE"],
    election: ["CREATE", "READ", "UPDATE", "DELETE"],
  },
  BENDAHARA: {
    feeRule: ["CREATE", "READ", "UPDATE", "DELETE"],
    category: ["CREATE", "READ", "UPDATE", "DELETE"],
    user: ["READ"],
    invoice: ["CREATE", "READ", "UPDATE", "DELETE"],
    payment: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    cash: ["CREATE", "READ", "UPDATE", "DELETE"],
    report: ["READ", "EXPORT"],
  },
  PENGURUS: {
    user: ["READ"],
    category: ["READ"],
    cash: ["CREATE", "READ"],
    period: ["READ"],
    position: ["READ"],
    event: ["CREATE", "READ", "UPDATE", "DELETE"],
    election: ["CREATE", "READ", "UPDATE", "DELETE"],
  },
  PENGHUNI: {
    invoice: ["READ"],
    payment: ["READ", "CREATE"],
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
      !code.startsWith("system") &&
      !["me.invoice", "me.payment", "me.document", "me.attendance", "me.election"].includes(
        code,
      ),
  ),
  BENDAHARA: [
    "dashboard",
    "master",
    "master.feeRule",
    "master.category",
    "resident",
    "resident.list",
    "finance",
    "finance.invoice",
    "finance.payment",
    "finance.expense",
    "finance.cash",
    "finance.report",
  ],
  PENGURUS: [
    "dashboard",
    "resident",
    "resident.list",
    "finance",
    "finance.expense",
    "organization",
    "organization.period",
    "organization.position",
    "organization.assign",
    "event",
    "event.list",
    "event.session",
    "event.committee",
    "event.attendance",
    "event.attachment",
    "election",
    "election.list",
    "election.candidate",
    "election.eligible",
    "election.result",
    "me",
    "me.profile",
  ],
  PENGHUNI: [
    "dashboard",
    "event.list",
    "event.session",
    "event.attendance",
    "election.list",
    "election.result",
    "me.profile",
    "me.invoice",
    "me.payment",
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

function syncList(existing: string[], desired: string[]) {
  const existingSet = new Set(existing);
  const desiredSet = new Set(desired);
  return {
    add: [...desiredSet].filter((id) => !existingSet.has(id)),
    remove: [...existingSet].filter((id) => !desiredSet.has(id)),
  };
}

export async function seedRoles({ menuIds, permissionIds }: SeedRolesInput) {
  const roleIds = new Map<string, string>();

  for (const role of ROLES) {
    const row = await prisma.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem ?? false,
        isActive: true,
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem ?? false,
        isActive: true,
        deletedAt: null,
      },
    });
    roleIds.set(role.code, row.id);

    const permissionCodes =
      role.code === "SUPER_ADMIN"
        ? [...permissionIds.keys()]
        : [
            ...new Set(
              Object.entries(ROLE_PERMISSIONS[role.code] ?? {}).flatMap(([resource, actions]) =>
                (actions ?? []).map((action) => permissionCode(resource, action)),
              ),
            ),
          ];

    const desiredPermissionIds = permissionCodes.map((code) =>
      requireId(permissionIds, code, "permission"),
    );

    const menuCodes = [
      ...new Set((ROLE_MENUS[role.code] ?? []).map((code) => requireId(menuIds, code, "menu"))),
    ];

    const existingPermissions = await prisma.rolePermission.findMany({
      where: { roleId: row.id },
      select: { permissionId: true },
    });
    const existingMenus = await prisma.roleMenu.findMany({
      where: { roleId: row.id },
      select: { menuId: true },
    });

    const permissionDiff = syncList(
      existingPermissions.map((item) => item.permissionId),
      desiredPermissionIds,
    );
    const menuDiff = syncList(
      existingMenus.map((item) => item.menuId),
      menuCodes,
    );

    await prisma.$transaction(async (tx) => {
      if (permissionDiff.remove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: { roleId: row.id, permissionId: { in: permissionDiff.remove } },
        });
      }
      if (permissionDiff.add.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionDiff.add.map((permissionId) => ({ roleId: row.id, permissionId })),
          skipDuplicates: true,
        });
      }
      if (menuDiff.remove.length > 0) {
        await tx.roleMenu.deleteMany({
          where: { roleId: row.id, menuId: { in: menuDiff.remove } },
        });
      }
      if (menuDiff.add.length > 0) {
        await tx.roleMenu.createMany({
          data: menuDiff.add.map((menuId) => ({ roleId: row.id, menuId })),
          skipDuplicates: true,
        });
      }
    });

    console.log(
      `  ✓ role ${role.code}: ${permissionCodes.length} permissions, ${menuCodes.length} menus`,
    );
  }

  return roleIds;
}
