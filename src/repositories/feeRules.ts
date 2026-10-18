import type { FeeRule } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { FeeRule };

export const feeRuleRepository = {
  create(data: {
    buildingId: string;
    dueDayOfMonth: number;
    defaultMonthlyRate: number;
    effectiveFrom: Date;
  }) {
    return prisma.feeRule.create({ data });
  },

  findById(id: string) {
    return prisma.feeRule.findFirst({ where: { id, deletedAt: null } });
  },

  findByBuilding(buildingId: string) {
    return prisma.feeRule.findMany({
      where: { buildingId, deletedAt: null },
      orderBy: { effectiveFrom: "desc" },
    });
  },

  findActiveForBuilding(buildingId: string, at: Date) {
    return prisma.feeRule.findFirst({
      where: { buildingId, deletedAt: null, effectiveFrom: { lte: at } },
      orderBy: { effectiveFrom: "desc" },
    });
  },

  list(buildingIds?: string[]) {
    return prisma.feeRule.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
      orderBy: [{ buildingId: "asc" }, { effectiveFrom: "desc" }],
    });
  },

  softDelete(id: string) {
    return prisma.feeRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type FeeRuleRepository = typeof feeRuleRepository;
