import type {
  PermissionEffect,
} from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type OverrideInput = { permissionId: string; effect: PermissionEffect };

export const userPermissionOverrideRepository = {
  listForUser(userId: string) {
    return prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { permissionId: true, permission: { select: { code: true } }, effect: true },
    });
  },

  // Full replace under one transaction — same contract as rolePermissions.replaceForRole.
  replaceForUser(userId: string, overrides: OverrideInput[]) {
    return prisma.$transaction([
      prisma.userPermissionOverride.deleteMany({ where: { userId } }),
      prisma.userPermissionOverride.createMany({
        data: overrides.map((override) => ({
          userId,
          permissionId: override.permissionId,
          effect: override.effect,
        })),
        skipDuplicates: true,
      }),
    ]);
  },
};

export type UserPermissionOverrideRepository = typeof userPermissionOverrideRepository;
