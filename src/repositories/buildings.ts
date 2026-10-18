import type { Building, Gender } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Building, Gender };

export const buildingRepository = {
  create(data: {
    code: string;
    name: string;
    gender: Gender;
    address: string;
  }) {
    return prisma.building.create({ data });
  },

  findByCode(code: string) {
    return prisma.building.findFirst({ where: { code, deletedAt: null } });
  },

  findById(id: string) {
    return prisma.building.findFirst({ where: { id, deletedAt: null } });
  },

  list() {
    return prisma.building.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      gender?: Gender;
      address?: string;
      isActive?: boolean;
    },
  ) {
    return prisma.building.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.building.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type BuildingRepository = typeof buildingRepository;
