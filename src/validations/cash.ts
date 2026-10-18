import { z } from "zod";

const cashAccountType = z.enum(["CASH", "BANK"]);
const categoryKind = z.enum(["INCOME", "EXPENSE"]);

export const createCashAccountSchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  type: cashAccountType.optional(),
  openingBalance: z.number().int().optional(),
});

export const updateCashAccountSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: cashAccountType.optional(),
  openingBalance: z.number().int().optional(),
});

export const createCategorySchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  kind: categoryKind,
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  kind: categoryKind.optional(),
});

export const listCategoryQuerySchema = z.object({
  kind: categoryKind.optional(),
});

export const recordExpenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().int().positive(),
  occurredAt: z.coerce.date(),
  receiptFileId: z.string().min(1),
  cashAccountId: z.string().min(1).optional(),
  vendor: z.string().trim().max(150).optional(),
  description: z.string().trim().max(255).optional(),
  eventId: z.string().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(100),
});

export const recordIncomeSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(1).max(100),
  occurredAt: z.coerce.date().optional(),
  cashAccountId: z.string().min(1).optional(),
  description: z.string().trim().max(255).optional(),
});

export const reversalSchema = z.object({
  reason: z.string().trim().min(1).max(255),
});

export const ledgerQuerySchema = z.object({
  cashAccountId: z.string().min(1).optional(),
});
