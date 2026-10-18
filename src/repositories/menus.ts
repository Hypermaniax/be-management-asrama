import type { Menu } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Menu };

export const menuRepository = {
  create(data: {
    code: string;
    name: string;
    path: string;
    parentId?: string | null;
    icon?: string | null;
    sortOrder?: number;
  }) {
    return prisma.menu.create({
      data: {
        code: data.code,
        name: data.name,
        path: data.path,
        parentId: data.parentId ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  },

  findByCode(code: string) {
    return prisma.menu.findFirst({ where: { code, deletedAt: null } });
  },

  list() {
    return prisma.menu.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      path?: string;
      icon?: string | null;
      parentId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return prisma.menu.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.menu.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type MenuRepository = typeof menuRepository;
