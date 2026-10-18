import { prisma } from "../lib/prisma.ts";

export const roleMenuRepository = {
  replaceForRole(roleId: string, menuIds: string[]) {
    return prisma.$transaction([
      prisma.roleMenu.deleteMany({ where: { roleId } }),
      prisma.roleMenu.createMany({
        data: menuIds.map((menuId) => ({ roleId, menuId })),
        skipDuplicates: true,
      }),
    ]);
  },
};

export type RoleMenuRepository = typeof roleMenuRepository;
