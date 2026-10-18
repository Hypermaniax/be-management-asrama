import type { Category, CategoryKind } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Category, CategoryKind };

export type CreateCategoryInput = {
  buildingId: string;
  name: string;
  kind: CategoryKind;
};

export type UpdateCategoryInput = {
  name?: string;
  kind?: CategoryKind;
};

export const categoryRepository = {
  create(data: CreateCategoryInput) {
    return prisma.category.create({ data });
  },

  findById(id: string) {
    return prisma.category.findFirst({ where: { id, deletedAt: null } });
  },

  findByName(buildingId: string, name: string) {
    return prisma.category.findFirst({
      where: { buildingId, name, deletedAt: null },
    });
  },

  list(buildingIds?: string[], kind?: CategoryKind) {
    return prisma.category.findMany({
      where: {
        deletedAt: null,
        ...(kind ? { kind } : {}),
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  },

  update(id: string, data: UpdateCategoryInput) {
    return prisma.category.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type CategoryRepository = typeof categoryRepository;
