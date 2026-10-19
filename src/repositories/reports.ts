import { prisma } from "../lib/prisma.ts";

export type DateRange = { from?: Date; to?: Date };

const rangeWhere = (range: DateRange) =>
  range.from || range.to
    ? {
        occurredAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      }
    : {};

export const reportRepository = {
  listArrears(buildingIds?: string[], filters: { year?: number; month?: number } = {}) {
    return prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
        ...(filters.year ? { periodYear: filters.year } : {}),
        ...(filters.month ? { periodMonth: filters.month } : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
      },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
  },

  listCashAccounts(buildingIds?: string[]) {
    return prisma.cashAccount.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
      include: { building: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  sumLedgerByAccount() {
    return prisma.ledgerEntry.groupBy({
      by: ["cashAccountId", "direction"],
      _sum: { amount: true },
    });
  },

  sumLedgerByDirection(buildingIds?: string[], range: DateRange = {}) {
    return prisma.ledgerEntry.groupBy({
      by: ["direction"],
      where: {
        ...(buildingIds ? { cashAccount: { buildingId: { in: buildingIds } } } : {}),
        ...rangeWhere(range),
      },
      _sum: { amount: true },
    });
  },

  sumLedgerByCategory(buildingIds?: string[], range: DateRange = {}) {
    return prisma.ledgerEntry.groupBy({
      by: ["categoryId", "direction"],
      where: {
        ...(buildingIds ? { cashAccount: { buildingId: { in: buildingIds } } } : {}),
        ...rangeWhere(range),
      },
      _sum: { amount: true },
    });
  },

  findEvent(id: string) {
    return prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: { building: { select: { id: true, name: true } } },
    });
  },

  sumEventExpenses(eventId: string) {
    return prisma.expense.aggregate({
      where: { eventId, deletedAt: null },
      _sum: { amount: true },
      _count: true,
    });
  },
};

export type ReportRepository = typeof reportRepository;
