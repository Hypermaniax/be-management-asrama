import { z } from "zod";

export const createRoomSchema = z.object({
  buildingId: z.string().min(1),
  number: z.string().trim().min(1).max(20),
  capacity: z.number().int().positive(),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).optional(),
});

export const updateRoomSchema = z.object({
  number: z.string().trim().min(1).max(20).optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).optional(),
});
