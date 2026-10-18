import { z } from "zod";

export const createDocumentTypeSchema = z.object({
  buildingId: z.string().min(1),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  isRequiredByDefault: z.boolean().optional(),
  allowedMimeTypes: z.array(z.string().min(1)).min(1),
  maxSizeBytes: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
});

export const requestDocumentSchema = z.object({
  userId: z.string().min(1),
  documentTypeId: z.string().min(1),
});

export const uploadDocumentSchema = z.object({
  documentTypeId: z.string().min(1),
});

export const rejectDocumentSchema = z.object({
  reason: z.string().trim().min(1).max(255),
});

export const listDocumentTypeQuerySchema = z.object({
  buildingId: z.string().min(1),
});

export const listDocumentQuerySchema = z.object({
  userId: z.string().min(1),
});
