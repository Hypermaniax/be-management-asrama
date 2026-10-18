import { z } from "zod";

export const createFeeRuleSchema = z.object({
  buildingId: z.string().min(1),
  dueDayOfMonth: z.number().int().min(1).max(28),
  defaultMonthlyRate: z.number().int().nonnegative(),
  effectiveFrom: z.coerce.date(),
});
