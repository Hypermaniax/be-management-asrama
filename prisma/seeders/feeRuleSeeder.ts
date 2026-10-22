import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded, requireId, syncSoftRecord } from "./utils.ts";

export type FeeRuleSeed = {
  buildingCode: string;
  dueDayOfMonth: number;
  defaultMonthlyRate: number;
  effectiveFrom: Date;
};

export const FEE_RULES: FeeRuleSeed[] = [
  {
    buildingCode: "G1",
    dueDayOfMonth: 10,
    defaultMonthlyRate: 350000,
    effectiveFrom: new Date("2025-01-01"),
  },
  {
    buildingCode: "G2",
    dueDayOfMonth: 10,
    defaultMonthlyRate: 400000,
    effectiveFrom: new Date("2025-01-01"),
  },
];

export async function seedFeeRules(buildingIds: Map<string, string>) {
  let count = 0;

  for (const rule of FEE_RULES) {
    const buildingId = requireId(buildingIds, rule.buildingCode, "building");
    const data = {
      dueDayOfMonth: rule.dueDayOfMonth,
      defaultMonthlyRate: rule.defaultMonthlyRate,
      deletedAt: null,
    };

    await syncSoftRecord({
      findActive: () =>
        prisma.feeRule.findFirst({
          where: {
            buildingId,
            effectiveFrom: rule.effectiveFrom,
            deletedAt: null,
          },
        }),
      findAny: () =>
        prisma.feeRule.findFirst({
          where: { buildingId, effectiveFrom: rule.effectiveFrom },
          orderBy: { createdAt: "asc" },
        }),
      create: () =>
        prisma.feeRule.create({
          data: { buildingId, effectiveFrom: rule.effectiveFrom, ...data },
        }),
      update: (id) => prisma.feeRule.update({ where: { id }, data }),
    });
    count++;
  }

  logSeeded("fee rules", count);
  return count;
}
