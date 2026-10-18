import { z } from "zod";

export const createFacilitySchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  scope: z.enum(["ROOM", "PUBLIC"]),
  usageMode: z.enum(["ASSIGNED", "SHARED"]),
  category: z.enum(["FURNITURE", "SANITARY", "APPLIANCE", "OTHER"]),
});

export const updateFacilitySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  usageMode: z.enum(["ASSIGNED", "SHARED"]).optional(),
  category: z.enum(["FURNITURE", "SANITARY", "APPLIANCE", "OTHER"]).optional(),
  isActive: z.boolean().optional(),
});

export const setRoomFacilitiesSchema = z.object({
  items: z.array(
    z.object({
      facilityId: z.string().min(1),
      quantity: z.number().int().positive(),
      note: z.string().trim().max(255).nullable().optional(),
    }),
  ),
});

export const facilityScopeQuerySchema = z.enum(["ROOM", "PUBLIC"]).optional();
