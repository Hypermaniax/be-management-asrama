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

export const listMyInvoiceQuerySchema = z.object({
  status: z.enum(["ISSUED", "PARTIAL", "PAID", "OVERDUE", "VOID"]).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const createSubmissionSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.enum(["TRANSFER", "QRIS"]),
  proofFileId: z.string().min(1),
  referenceNo: z.string().trim().max(100).optional(),
  note: z.string().trim().max(255).optional(),
});

export const verifySubmissionSchema = z.object({
  cashAccountId: z.string().min(1).optional(),
});

export const rejectSubmissionSchema = z.object({
  reason: z.string().trim().min(1).max(255),
});

export const listSubmissionQuerySchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
  userId: z.string().min(1).optional(),
});

export const listMySubmissionQuerySchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});
