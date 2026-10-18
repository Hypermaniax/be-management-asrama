import type {
  Event,
  EventCategory,
  EventRecurrence,
  EventScope,
  EventStatus,
} from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Event, EventCategory, EventRecurrence, EventScope, EventStatus };

export type CreateEventInput = {
  title: string;
  description?: string | null;
  category: EventCategory;
  isAdHoc?: boolean;
  scope: EventScope;
  buildingId?: string | null;
  startAt: Date;
  endAt?: Date | null;
  location?: string | null;
  budgetAmount?: number | null;
  status?: EventStatus;
  isPublic?: boolean;
  recurrence?: EventRecurrence;
  createdById: string;
};

export type UpdateEventInput = {
  title?: string;
  description?: string | null;
  category?: EventCategory;
  scope?: EventScope;
  buildingId?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  location?: string | null;
  budgetAmount?: number | null;
  isPublic?: boolean;
  recurrence?: EventRecurrence;
};

export type ListEventFilters = {
  status?: EventStatus;
  category?: EventCategory;
  publicOnly?: boolean;
};

export const eventRepository = {
  create(data: CreateEventInput) {
    return prisma.event.create({ data });
  },

  findById(id: string) {
    return prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: { building: true },
    });
  },

  list(buildingIds?: string[], filters: ListEventFilters = {}) {
    return prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.publicOnly ? { isPublic: true } : {}),
        ...(buildingIds
          ? { OR: [{ buildingId: null }, { buildingId: { in: buildingIds } }] }
          : {}),
      },
      include: { building: true },
      orderBy: { startAt: "desc" },
    });
  },

  listByBuilding(buildingId: string) {
    return prisma.event.findMany({
      where: { buildingId, deletedAt: null },
      orderBy: { startAt: "desc" },
    });
  },

  update(id: string, data: UpdateEventInput) {
    return prisma.event.update({ where: { id }, data });
  },

  setStatus(id: string, status: EventStatus) {
    return prisma.event.update({ where: { id }, data: { status } });
  },

  softDelete(id: string) {
    return prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type EventRepository = typeof eventRepository;
