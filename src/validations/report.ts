import { z } from "zod";

export const arrearsQuerySchema = z.object({
  buildingId: z.string().min(1).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const cashBalanceQuerySchema = z.object({
  buildingId: z.string().min(1).optional(),
});

export const incomeVsExpenseQuerySchema = z.object({
  buildingId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
