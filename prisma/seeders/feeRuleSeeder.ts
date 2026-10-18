import { prisma } from "../../src/lib/prisma.ts";

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
    const buildingId = buildingIds.get(rule.buildingCode);
    if (!buildingId) continue;

    const existing = await prisma.feeRule.findFirst({
      where: { buildingId, effectiveFrom: rule.effectiveFrom, deletedAt: null },
    });

    const data = {
      dueDayOfMonth: rule.dueDayOfMonth,
      defaultMonthlyRate: rule.defaultMonthlyRate,
    };

    if (existing) {
      await prisma.feeRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.feeRule.create({
        data: { buildingId, effectiveFrom: rule.effectiveFrom, ...data },
      });
    }
    count++;
  }

  console.log(`seeded ${count} fee rules`);
  return count;
}
