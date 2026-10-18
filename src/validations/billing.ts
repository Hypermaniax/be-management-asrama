import { z } from "zod";

export const generateInvoiceSchema = z.object({
  buildingId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const listInvoiceQuerySchema = z.object({
  buildingId: z.string().min(1).optional(),
  status: z.enum(["ISSUED", "PARTIAL", "PAID", "OVERDUE", "VOID"]).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const recordPaymentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.enum(["CASH", "TRANSFER", "QRIS"]),
  cashAccountId: z.string().min(1).optional(),
  referenceNo: z.string().trim().max(100).optional(),
  proofFileId: z.string().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(100),
  note: z.string().trim().max(255).optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().min(1),
        amount: z.number().int().positive(),
      }),
    )
    .optional(),
});

export const listPaymentQuerySchema = z.object({
  userId: z.string().min(1).optional(),
});
