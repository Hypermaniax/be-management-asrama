import { z } from "zod";

export const listAuditQuerySchema = z.object({
  entity: z.string().trim().min(1).optional(),
  entityId: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});
