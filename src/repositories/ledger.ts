import type {
  LedgerDirection,
  LedgerEntry,
  LedgerSource,
} from "../generated/prisma/client.ts";
import type { Db } from "../lib/prisma.ts";
import { prisma } from "../lib/prisma.ts";

export type { LedgerDirection, LedgerEntry, LedgerSource };

export type CreateLedgerEntryInput = {
  cashAccountId: string;
  direction: LedgerDirection;
  amount: number;
  categoryId: string;
  sourceType: LedgerSource;
  sourceId?: string | null;
  idempotencyKey: string;
  occurredAt?: Date;
  description?: string | null;
  createdById?: string | null;
};

export const ledgerRepository = {
  create(data: CreateLedgerEntryInput, client: Db = prisma) {
    return client.ledgerEntry.create({ data });
  },

  findById(id: string) {
    return prisma.ledgerEntry.findFirst({ where: { id } });
  },

  findBySource(sourceType: LedgerSource, sourceId: string) {
    return prisma.ledgerEntry.findFirst({ where: { sourceType, sourceId } });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.ledgerEntry.findFirst({ where: { idempotencyKey } });
  },

  listByAccount(cashAccountId: string) {
    return prisma.ledgerEntry.findMany({
      where: { cashAccountId },
      orderBy: { occurredAt: "desc" },
    });
  },

  list(buildingIds?: string[], filters: { cashAccountId?: string } = {}) {
    return prisma.ledgerEntry.findMany({
      where: {
        ...(filters.cashAccountId ? { cashAccountId: filters.cashAccountId } : {}),
        ...(buildingIds ? { cashAccount: { buildingId: { in: buildingIds } } } : {}),
      },
      orderBy: { occurredAt: "desc" },
    });
  },

  async sumByAccount(cashAccountId: string) {
    const grouped = await prisma.ledgerEntry.groupBy({
      by: ["direction"],
      where: { cashAccountId },
      _sum: { amount: true },
    });
    const totalIn = grouped.find((row) => row.direction === "IN")?._sum.amount ?? 0;
    const totalOut = grouped.find((row) => row.direction === "OUT")?._sum.amount ?? 0;
    return { totalIn, totalOut };
  },
};

export type LedgerRepository = typeof ledgerRepository;
