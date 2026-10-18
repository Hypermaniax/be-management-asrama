import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  buildingId: z.string().min(1).nullable().optional(),
  nationalId: z.string().trim().max(30).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  guardianName: z.string().trim().max(100).nullable().optional(),
  guardianPhone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(255).nullable().optional(),
});

export const approveResidentSchema = z.object({
  buildingId: z.string().min(1).nullable().optional(),
});

export const rejectResidentSchema = z.object({
  reason: z.string().trim().min(1).max(255),
});

export const listResidentQuerySchema = z.object({
  buildingId: z.string().min(1),
  status: z
    .enum(["PENDING", "ACTIVE", "REJECTED", "CHECKOUT", "INACTIVE"])
    .optional(),
});
