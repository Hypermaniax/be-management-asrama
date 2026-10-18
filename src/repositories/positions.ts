import type { Position } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Position };

export type CreatePositionInput = {
  code: string;
  name: string;
  level?: number;
  buildingId?: string | null;
  roleId?: string | null;
  description?: string | null;
};

export type UpdatePositionInput = {
  name?: string;
  level?: number;
  buildingId?: string | null;
  roleId?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export const positionRepository = {
  create(data: CreatePositionInput) {
    return prisma.position.create({ data });
  },

  findById(id: string) {
    return prisma.position.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
  },

  findByCode(code: string, buildingId?: string | null) {
    return prisma.position.findFirst({
      where: { code, buildingId: buildingId ?? null, deletedAt: null },
    });
  },

  list(buildingIds?: string[]) {
    return prisma.position.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds
          ? { OR: [{ buildingId: null }, { buildingId: { in: buildingIds } }] }
          : {}),
      },
      include: { role: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });
  },

  listByBuilding(buildingId: string) {
    return prisma.position.findMany({
      where: { buildingId, deletedAt: null },
      include: { role: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });
  },

  update(id: string, data: UpdatePositionInput) {
    return prisma.position.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.position.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  },
};

export type PositionRepository = typeof positionRepository;
