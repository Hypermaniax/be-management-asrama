import { z } from "zod";

export const electionSchema = z.object({
  code: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  periodId: z.string().min(1).optional(),
  buildingId: z.string().min(1).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  allowAbstain: z.boolean().optional(),
  eligibleRoleIds: z.array(z.string().min(1)).optional(),
});

export const updateElectionSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  periodId: z.string().min(1).nullable().optional(),
  buildingId: z.string().min(1).nullable().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  allowAbstain: z.boolean().optional(),
});

export const eligibleRoleSchema = z.object({
  roleIds: z.array(z.string().min(1)),
});

export const candidateSchema = z.object({
  userId: z.string().min(1),
  orderNo: z.number().int().min(0).optional(),
  vision: z.string().trim().max(1000).optional(),
  mission: z.string().trim().max(2000).optional(),
});

export const voteSchema = z.object({
  candidateId: z.string().min(1).nullable().optional(),
});

export const finalizeSchema = z.object({
  candidateId: z.string().min(1).optional(),
  positionId: z.string().min(1),
});

export const listElectionQuerySchema = z.object({
  status: z
    .enum(["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "DONE", "CANCELLED"])
    .optional(),
});
