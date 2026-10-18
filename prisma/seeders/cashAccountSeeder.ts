import { prisma } from "../../src/lib/prisma.ts";

export type CashAccountSeed = {
  buildingCode: string;
  name: string;
  openingBalance: number;
};

export const CASH_ACCOUNTS: CashAccountSeed[] = [
  { buildingCode: "G1", name: "Kas Tunai G1", openingBalance: 0 },
  { buildingCode: "G2", name: "Kas Tunai G2", openingBalance: 0 },
];

export async function seedCashAccounts(buildingIds: Map<string, string>) {
  let count = 0;

  for (const account of CASH_ACCOUNTS) {
    const buildingId = buildingIds.get(account.buildingCode);
    if (!buildingId) continue;

    const existing = await prisma.cashAccount.findFirst({
      where: { buildingId, deletedAt: null },
    });

    const data = { name: account.name, openingBalance: account.openingBalance };

    if (existing) {
      await prisma.cashAccount.update({ where: { id: existing.id }, data });
    } else {
      await prisma.cashAccount.create({
        data: { buildingId, type: "CASH", ...data },
      });
    }
    count++;
  }

  console.log(`seeded ${count} cash accounts`);
  return count;
}
