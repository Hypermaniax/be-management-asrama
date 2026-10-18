import type { EventSession } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { EventSession };

export type CreateEventSessionInput = {
  eventId: string;
  title?: string | null;
  scheduledAt: Date;
  startAt?: Date | null;
  endAt?: Date | null;
  location?: string | null;
  note?: string | null;
};

export const eventSessionRepository = {
  create(data: CreateEventSessionInput) {
    return prisma.eventSession.create({ data });
  },

  findById(id: string) {
    return prisma.eventSession.findFirst({ where: { id, deletedAt: null } });
  },

  findBySchedule(eventId: string, scheduledAt: Date) {
    return prisma.eventSession.findFirst({
      where: { eventId, scheduledAt, deletedAt: null },
    });
  },

  listByEvent(eventId: string) {
    return prisma.eventSession.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { scheduledAt: "asc" },
    });
  },

  softDelete(id: string) {
    return prisma.eventSession.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type EventSessionRepository = typeof eventSessionRepository;
