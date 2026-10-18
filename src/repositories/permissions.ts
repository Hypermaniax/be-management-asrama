import type { Permission, PermissionAction } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Permission };

export const permissionRepository = {
  create(data: {
    code: string;
    resource: string;
    action: PermissionAction;
    description?: string | null;
  }) {
    return prisma.permission.create({
      data: {
        code: data.code,
        resource: data.resource,
        action: data.action,
        description: data.description ?? null,
      },
    });
  },

  findByCode(code: string) {
    return prisma.permission.findUnique({ where: { code } });
  },

  list() {
    return prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
  },

  upsertByResourceAction(data: {
    code: string;
    resource: string;
    action: PermissionAction;
    description?: string | null;
  }) {
    return prisma.permission.upsert({
      where: {
        resource_action: { resource: data.resource, action: data.action },
      },
      create: {
        code: data.code,
        resource: data.resource,
        action: data.action,
        description: data.description ?? null,
      },
      update: {
        code: data.code,
        description: data.description ?? null,
      },
    });
  },
};

export type PermissionRepository = typeof permissionRepository;
