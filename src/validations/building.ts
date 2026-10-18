import { z } from "zod";

export const buildingSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  gender: z.enum(["MALE", "FEMALE"]),
  address: z.string().trim().min(1).max(255),
});

export const updateBuildingSchema = buildingSchema.partial().extend({
  isActive: z.boolean().optional(),
});
