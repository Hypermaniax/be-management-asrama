import type { PublicFacStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { PublicFacStatus };

export const publicFacilityRepository = {
  create(data: {
    buildingId: string;
    facilityId: string;
    number?: string | null;
    capacity?: number | null;
    status?: PublicFacStatus;
    note?: string | null;
  }) {
    return prisma.publicFacility.create({ data });
  },

  findById(id: string) {
    return prisma.publicFacility.findFirst({
      where: { id, deletedAt: null },
      include: { facility: true },
    });
  },

  findByBuildingFacilityNumber(
    buildingId: string,
    facilityId: string,
    number: string,
  ) {
    return prisma.publicFacility.findFirst({
      where: { buildingId, facilityId, number, deletedAt: null },
    });
  },

  list(buildingIds?: string[]) {
    return prisma.publicFacility.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
      include: { facility: true },
      orderBy: [{ buildingId: "asc" }, { number: "asc" }],
    });
  },

  listByBuilding(buildingId: string) {
    return prisma.publicFacility.findMany({
      where: { buildingId, deletedAt: null },
      include: { facility: true },
      orderBy: { number: "asc" },
    });
  },

  update(
    id: string,
    data: {
      number?: string | null;
      capacity?: number | null;
      status?: PublicFacStatus;
      note?: string | null;
    },
  ) {
    return prisma.publicFacility.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.publicFacility.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type PublicFacilityRepository = typeof publicFacilityRepository;
