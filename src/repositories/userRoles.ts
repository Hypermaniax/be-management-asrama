import { prisma } from "../lib/prisma.ts";

export const userRoleRepository = {
  async assign(data: { userId: string; roleId: string; buildingId?: string | null }) {
    const buildingId = data.buildingId ?? null;
    const existing = await prisma.userRole.findFirst({
      where: { userId: data.userId, roleId: data.roleId, buildingId },
    });
    if (existing) {
      return prisma.userRole.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
    }
    return prisma.userRole.create({
      data: { userId: data.userId, roleId: data.roleId, buildingId },
    });
  },

  remove(id: string) {
    return prisma.userRole.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  listByUser(userId: string) {
    return prisma.userRole.findMany({
      where: { userId, deletedAt: null },
      include: { role: true },
    });
  },

  listByUserWithPermissions(userId: string) {
    return prisma.userRole.findMany({
      where: {
        userId,
        deletedAt: null,
        role: { deletedAt: null, isActive: true },
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
            menus: { include: { menu: true } },
          },
        },
      },
    });
  },
};

export type UserRoleRepository = typeof userRoleRepository;
