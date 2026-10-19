import type { EventCommittee } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export type { EventCommittee };

export type CreateEventCommitteeInput = {
  eventId: string;
  userId: string;
  eventRole: string;
  positionId?: string | null;
};

export const eventCommitteeRepository = {
  add(data: CreateEventCommitteeInput) {
    return prisma.eventCommittee.create({ data });
  },

  findById(id: string) {
    return prisma.eventCommittee.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: publicUserSelect }, position: true },
    });
  },

  findByUser(eventId: string, userId: string) {
    return prisma.eventCommittee.findFirst({
      where: { eventId, userId, deletedAt: null },
    });
  },

  listByEvent(eventId: string) {
    return prisma.eventCommittee.findMany({
      where: { eventId, deletedAt: null },
      include: { user: { select: publicUserSelect }, position: true },
      orderBy: { createdAt: "asc" },
    });
  },

  listByUser(userId: string) {
    return prisma.eventCommittee.findMany({
      where: { userId, deletedAt: null },
      include: { event: true },
      orderBy: { createdAt: "desc" },
    });
  },

  remove(id: string) {
    return prisma.eventCommittee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type EventCommitteeRepository = typeof eventCommitteeRepository;
