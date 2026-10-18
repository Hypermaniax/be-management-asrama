import type { DocumentType } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { DocumentType };

export const documentTypeRepository = {
  create(data: {
    buildingId: string;
    code: string;
    name: string;
    isRequiredByDefault?: boolean;
    allowedMimeTypes: string[];
    maxSizeBytes: number;
    sortOrder?: number;
  }) {
    return prisma.documentType.create({ data });
  },

  findById(id: string) {
    return prisma.documentType.findFirst({ where: { id, deletedAt: null } });
  },

  findByBuildingCode(buildingId: string, code: string) {
    return prisma.documentType.findFirst({
      where: { buildingId, code, deletedAt: null },
    });
  },

  listByBuilding(buildingId: string) {
    return prisma.documentType.findMany({
      where: { buildingId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });
  },

  listRequiredByBuilding(buildingId: string) {
    return prisma.documentType.findMany({
      where: { buildingId, deletedAt: null, isActive: true, isRequiredByDefault: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      isRequiredByDefault?: boolean;
      isActive?: boolean;
      allowedMimeTypes?: string[];
      maxSizeBytes?: number;
      sortOrder?: number;
    },
  ) {
    return prisma.documentType.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.documentType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type DocumentTypeRepository = typeof documentTypeRepository;
