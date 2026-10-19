import type { AttendanceStatus, EventAttendance } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export type { AttendanceStatus, EventAttendance };

export type CreateEventAttendanceInput = {
  sessionId: string;
  userId: string;
  status: AttendanceStatus;
  checkedInAt?: Date | null;
  note?: string | null;
};

export const eventAttendanceRepository = {
  create(data: CreateEventAttendanceInput) {
    return prisma.eventAttendance.create({ data });
  },

  findById(id: string) {
    return prisma.eventAttendance.findFirst({ where: { id, deletedAt: null } });
  },

  findBySessionUser(sessionId: string, userId: string) {
    return prisma.eventAttendance.findFirst({
      where: { sessionId, userId, deletedAt: null },
    });
  },

  update(
    id: string,
    data: { status?: AttendanceStatus; checkedInAt?: Date | null; note?: string | null },
  ) {
    return prisma.eventAttendance.update({ where: { id }, data });
  },

  listBySession(sessionId: string) {
    return prisma.eventAttendance.findMany({
      where: { sessionId, deletedAt: null },
      include: { user: { select: publicUserSelect } },
      orderBy: { createdAt: "asc" },
    });
  },

  listByUser(userId: string) {
    return prisma.eventAttendance.findMany({
      where: { userId, deletedAt: null },
      include: { session: { include: { event: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  listByEvent(eventId: string) {
    return prisma.eventAttendance.findMany({
      where: { deletedAt: null, session: { eventId, deletedAt: null } },
      include: { user: { select: publicUserSelect }, session: true },
      orderBy: { createdAt: "asc" },
    });
  },
};

export type EventAttendanceRepository = typeof eventAttendanceRepository;
