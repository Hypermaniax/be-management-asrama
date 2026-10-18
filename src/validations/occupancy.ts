import { z } from "zod";

export const placeOccupancySchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().min(1),
  bedLabel: z.string().trim().min(1).max(20).optional(),
});
