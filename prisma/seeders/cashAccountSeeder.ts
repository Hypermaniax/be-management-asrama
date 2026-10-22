import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded, requireId, syncSoftRecord } from "./utils.ts";

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
    const buildingId = requireId(buildingIds, account.buildingCode, "building");
    const data = {
      name: account.name,
      type: "CASH" as const,
      openingBalance: account.openingBalance,
      deletedAt: null,
    };

    await syncSoftRecord({
      findActive: () =>
        prisma.cashAccount.findFirst({
          where: { buildingId, deletedAt: null },
          orderBy: { createdAt: "asc" },
        }),
      findAny: () =>
        prisma.cashAccount.findFirst({
          where: { buildingId },
          orderBy: { createdAt: "asc" },
        }),
      create: () => prisma.cashAccount.create({ data: { buildingId, ...data } }),
      update: (id) => prisma.cashAccount.update({ where: { id }, data }),
    });
    count++;
  }

  logSeeded("cash accounts", count);
  return count;
}
