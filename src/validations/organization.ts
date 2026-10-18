import { z } from "zod";

export const periodSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  decreeNumber: z.string().trim().max(100).optional(),
});

export const updatePeriodSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  decreeNumber: z.string().trim().max(100).optional(),
});

export const positionSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  level: z.number().int().optional(),
  buildingId: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  description: z.string().trim().max(255).optional(),
});

export const updatePositionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  level: z.number().int().optional(),
  buildingId: z.string().min(1).nullable().optional(),
  roleId: z.string().min(1).nullable().optional(),
  description: z.string().trim().max(255).optional(),
  isActive: z.boolean().optional(),
});

export const assignPositionSchema = z.object({
  periodId: z.string().min(1),
  positionId: z.string().min(1),
  userId: z.string().min(1),
  buildingId: z.string().min(1).optional(),
  startDate: z.coerce.date(),
  decreeNumber: z.string().trim().max(100).optional(),
});

export const listAssignmentQuerySchema = z.object({
  userId: z.string().min(1),
});

export const structureQuerySchema = z.object({
  periodId: z.string().min(1),
});
