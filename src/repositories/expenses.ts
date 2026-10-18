import type { Expense } from "../generated/prisma/client.ts";
import type { Db } from "../lib/prisma.ts";
import { prisma } from "../lib/prisma.ts";

export type { Expense };

export type CreateExpenseInput = {
  cashAccountId: string;
  categoryId: string;
  amount: number;
  occurredAt: Date;
  vendor?: string | null;
  description?: string | null;
  receiptFileId: string;
  eventId?: string | null;
  createdById: string;
  idempotencyKey: string;
};

export const expenseRepository = {
  create(data: CreateExpenseInput, client: Db = prisma) {
    return client.expense.create({ data });
  },

  findById(id: string) {
    return prisma.expense.findFirst({ where: { id, deletedAt: null } });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.expense.findFirst({
      where: { idempotencyKey, deletedAt: null },
    });
  },

  list(buildingIds?: string[], filters: { cashAccountId?: string } = {}) {
    return prisma.expense.findMany({
      where: {
        deletedAt: null,
        ...(filters.cashAccountId ? { cashAccountId: filters.cashAccountId } : {}),
        ...(buildingIds ? { cashAccount: { buildingId: { in: buildingIds } } } : {}),
      },
      orderBy: { occurredAt: "desc" },
    });
  },
};

export type ExpenseRepository = typeof expenseRepository;
