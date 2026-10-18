import type { EventAttachment, EventAttachmentKind } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { EventAttachment, EventAttachmentKind };

export type CreateEventAttachmentInput = {
  eventId: string;
  fileId: string;
  kind: EventAttachmentKind;
  note?: string | null;
};

export const eventAttachmentRepository = {
  attach(data: CreateEventAttachmentInput) {
    return prisma.eventAttachment.create({ data });
  },

  findById(id: string) {
    return prisma.eventAttachment.findFirst({
      where: { id, deletedAt: null },
      include: { file: true },
    });
  },

  listByEvent(eventId: string) {
    return prisma.eventAttachment.findMany({
      where: { eventId, deletedAt: null },
      include: { file: true },
      orderBy: { createdAt: "asc" },
    });
  },

  remove(id: string) {
    return prisma.eventAttachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type EventAttachmentRepository = typeof eventAttachmentRepository;
