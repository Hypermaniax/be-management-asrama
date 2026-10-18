import { z } from "zod";

export const createPublicFacilitySchema = z.object({
  buildingId: z.string().min(1),
  facilityId: z.string().min(1),
  number: z.string().trim().min(1).max(20).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(255).nullable().optional(),
});

export const updatePublicFacilitySchema = z.object({
  number: z.string().trim().min(1).max(20).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).optional(),
  note: z.string().trim().max(255).nullable().optional(),
});

export const assignPublicFacilitySchema = z.object({
  userId: z.string().min(1),
  slotLabel: z.string().trim().min(1).max(10),
});
