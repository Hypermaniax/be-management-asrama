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

  listForRole(roleId: string) {
    return prisma.roleMenu.findMany({
      where: { roleId },
      select: { menuId: true },
    });
  },
};

export type RoleMenuRepository = typeof roleMenuRepository;
