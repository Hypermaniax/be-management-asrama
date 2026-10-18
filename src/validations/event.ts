import { z } from "zod";

const eventCategory = z.enum(["RUTIN", "BESAR"]);
const eventScope = z.enum(["ASRAMA", "GEDUNG"]);
const eventStatus = z.enum(["PLANNED", "ONGOING", "DONE", "CANCELLED"]);
const eventRecurrence = z.enum(["NONE", "WEEKLY", "MONTHLY"]);
const attendanceStatus = z.enum(["HADIR", "IZIN", "TIDAK"]);
const attachmentKind = z.enum(["PROPOSAL", "NOTULEN", "LPJ", "FOTO", "OTHER"]);

export const eventSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  category: eventCategory.optional(),
  isAdHoc: z.boolean().optional(),
  scope: eventScope.optional(),
  buildingId: z.string().min(1).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  location: z.string().trim().max(150).optional(),
  budgetAmount: z.number().int().nonnegative().optional(),
  isPublic: z.boolean().optional(),
  recurrence: eventRecurrence.optional(),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  category: eventCategory.optional(),
  scope: eventScope.optional(),
  buildingId: z.string().min(1).nullable().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  location: z.string().trim().max(150).optional(),
  budgetAmount: z.number().int().nonnegative().nullable().optional(),
  isPublic: z.boolean().optional(),
  recurrence: eventRecurrence.optional(),
});

export const statusSchema = z.object({ status: eventStatus });

export const sessionSchema = z.object({
  title: z.string().trim().max(150).optional(),
  scheduledAt: z.coerce.date(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  location: z.string().trim().max(150).optional(),
  note: z.string().trim().max(500).optional(),
});

export const generateSessionsSchema = z.object({
  dates: z.array(z.coerce.date()).min(1),
});

export const committeeSchema = z.object({
  userId: z.string().min(1),
  eventRole: z.string().trim().min(1).max(100),
  positionId: z.string().min(1).optional(),
});

export const attendanceSchema = z.object({
  records: z
    .array(
      z.object({
        userId: z.string().min(1),
        status: attendanceStatus,
        checkedInAt: z.coerce.date().optional(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .min(1),
});

export const attachmentSchema = z.object({
  fileId: z.string().min(1),
  kind: attachmentKind,
  note: z.string().trim().max(500).optional(),
});

export const listEventQuerySchema = z.object({
  status: eventStatus.optional(),
  category: eventCategory.optional(),
});
