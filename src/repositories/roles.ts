import type { Role } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Role };

export const roleRepository = {
  create(data: {
    code: string;
    name: string;
    description?: string | null;
    isSystem?: boolean;
  }) {
    return prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        isSystem: data.isSystem ?? false,
      },
    });
  },

  findByCode(code: string) {
    return prisma.role.findFirst({ where: { code, deletedAt: null } });
  },

  findById(id: string) {
    return prisma.role.findFirst({ where: { id, deletedAt: null } });
  },

  list() {
    return prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
    });
  },

  update(
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    return prisma.role.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type RoleRepository = typeof roleRepository;
