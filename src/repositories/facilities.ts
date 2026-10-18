import type {
  Facility,
  FacilityCategory,
  FacilityScope,
  FacilityUsage,
} from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Facility, FacilityCategory, FacilityScope, FacilityUsage };

export const facilityRepository = {
  create(data: {
    code: string;
    name: string;
    scope: FacilityScope;
    usageMode: FacilityUsage;
    category: FacilityCategory;
  }) {
    return prisma.facility.create({ data });
  },

  findById(id: string) {
    return prisma.facility.findFirst({ where: { id, deletedAt: null } });
  },

  findByCode(code: string) {
    return prisma.facility.findFirst({ where: { code, deletedAt: null } });
  },

  list(scope?: FacilityScope) {
    return prisma.facility.findMany({
      where: { deletedAt: null, ...(scope ? { scope } : {}) },
      orderBy: { code: "asc" },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      usageMode?: FacilityUsage;
      category?: FacilityCategory;
      isActive?: boolean;
    },
  ) {
    return prisma.facility.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.facility.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type FacilityRepository = typeof facilityRepository;
