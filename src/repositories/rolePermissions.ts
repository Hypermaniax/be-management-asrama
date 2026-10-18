import { prisma } from "../lib/prisma.ts";

export const rolePermissionRepository = {
  replaceForRole(roleId: string, permissionIds: string[]) {
    return prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  },
};

export type RolePermissionRepository = typeof rolePermissionRepository;
