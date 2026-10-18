import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type {
  AttendanceStatus,
  EventAttendanceRepository,
} from "../../repositories/eventAttendances.ts";
import type { EventAttachmentRepository } from "../../repositories/eventAttachments.ts";
import type { EventCommitteeRepository } from "../../repositories/eventCommittees.ts";
import type { EventSessionRepository } from "../../repositories/eventSessions.ts";
import type {
  EventCategory,
  EventRecurrence,
  EventRepository,
  EventScope,
  EventStatus,
  ListEventFilters,
} from "../../repositories/events.ts";
import type { FileRepository } from "../../repositories/files.ts";
import type { PositionRepository } from "../../repositories/positions.ts";
import type { UserRepository } from "../../repositories/users.ts";
import type { CashService } from "../cash/service.ts";

type EventDeps = {
  events: EventRepository;
  sessions: EventSessionRepository;
  committees: EventCommitteeRepository;
  attendances: EventAttendanceRepository;
  attachments: EventAttachmentRepository;
  buildings: BuildingRepository;
  users: UserRepository;
  positions: PositionRepository;
  files: FileRepository;
  cash: CashService;
};

type CreateEventInput = {
  title: string;
  description?: string | null;
  category?: EventCategory;
  isAdHoc?: boolean;
  scope?: EventScope;
  buildingId?: string | null;
  startAt: Date;
  endAt?: Date | null;
  location?: string | null;
  budgetAmount?: number | null;
  isPublic?: boolean;
  recurrence?: EventRecurrence;
  createdById: string;
};

type UpdateEventInput = {
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

type AttendanceRecord = {
  userId: string;
  status: AttendanceStatus;
  checkedInAt?: Date | null;
  note?: string | null;
};

type EventExpenseInput = {
  categoryId: string;
  amount: number;
  occurredAt: Date;
  receiptFileId: string;
  cashAccountId?: string | null;
  vendor?: string | null;
  description?: string | null;
  idempotencyKey: string;
  createdById?: string | null;
};

export const createEventService = ({
  events,
  sessions,
  committees,
  attendances,
  attachments,
  buildings,
  users,
  positions,
  files,
  cash,
}: EventDeps) => {
  const getEvent = async (id: string) => {
    const event = await events.findById(id);
    if (!event) {
      throw new AppError("Event not found", 404);
    }
    return event;
  };

  const getSession = async (id: string) => {
    const session = await sessions.findById(id);
    if (!session) {
      throw new AppError("Event session not found", 404);
    }
    return session;
  };

  const resolveScope = (
    scope: EventScope | undefined,
    buildingId: string | null | undefined,
  ): { scope: EventScope; buildingId: string | null } => {
    const resolved = scope ?? (buildingId ? "GEDUNG" : "ASRAMA");
    if (resolved === "GEDUNG") {
      if (!buildingId) {
        throw new AppError("buildingId is required for a GEDUNG event", 400);
      }
      return { scope: resolved, buildingId };
    }
    return { scope: "ASRAMA", buildingId: null };
  };

  return {
    async createEvent(input: CreateEventInput) {
      const { scope, buildingId } = resolveScope(input.scope, input.buildingId);
      if (buildingId && !(await buildings.findById(buildingId))) {
        throw new AppError("Building not found", 404);
      }

      const event = await events.create({
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "RUTIN",
        isAdHoc: input.isAdHoc ?? false,
        scope,
        buildingId,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        location: input.location ?? null,
        budgetAmount: input.budgetAmount ?? null,
        isPublic: input.isPublic ?? false,
        recurrence: input.recurrence ?? "NONE",
        createdById: input.createdById,
      });

      if ((input.recurrence ?? "NONE") === "NONE") {
        await sessions.create({
          eventId: event.id,
          title: event.title,
          scheduledAt: event.startAt,
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location,
        });
      }

      return event;
    },

    listEvents(buildingIds?: string[], filters: ListEventFilters = {}) {
      return events.list(buildingIds, filters);
    },

    getEvent,

    async getEventDetail(id: string) {
      const event = await getEvent(id);
      const [sessionList, committeeList, attachmentList, attendanceList] =
        await Promise.all([
          sessions.listByEvent(id),
          committees.listByEvent(id),
          attachments.listByEvent(id),
          attendances.listByEvent(id),
        ]);
      const summary = { HADIR: 0, IZIN: 0, TIDAK: 0 };
      for (const record of attendanceList) {
        summary[record.status] += 1;
      }
      return {
        ...event,
        sessions: sessionList,
        committees: committeeList,
        attachments: attachmentList,
        attendanceSummary: summary,
      };
    },

    async updateEvent(id: string, data: UpdateEventInput) {
      const event = await getEvent(id);
      const nextScope = data.scope ?? event.scope;
      const nextBuilding =
        data.buildingId !== undefined ? data.buildingId : event.buildingId;
      const { scope, buildingId } = resolveScope(nextScope, nextBuilding);
      if (buildingId && !(await buildings.findById(buildingId))) {
        throw new AppError("Building not found", 404);
      }
      return events.update(id, { ...data, scope, buildingId });
    },

    async changeStatus(id: string, status: EventStatus) {
      await getEvent(id);
      return events.setStatus(id, status);
    },

    async deleteEvent(id: string) {
      await getEvent(id);
      return events.softDelete(id);
    },

    async generateSessions(eventId: string, dates: Date[]) {
      await getEvent(eventId);
      const created = [];
      for (const scheduledAt of dates) {
        const existing = await sessions.findBySchedule(eventId, scheduledAt);
        if (existing) continue;
        created.push(await sessions.create({ eventId, scheduledAt }));
      }
      return created;
    },

    async addSession(
      eventId: string,
      data: {
        title?: string | null;
        scheduledAt: Date;
        startAt?: Date | null;
        endAt?: Date | null;
        location?: string | null;
        note?: string | null;
      },
    ) {
      await getEvent(eventId);
      if (await sessions.findBySchedule(eventId, data.scheduledAt)) {
        throw new AppError("Session already exists at this schedule", 409);
      }
      return sessions.create({ eventId, ...data });
    },

    async deleteSession(id: string) {
      await getSession(id);
      return sessions.softDelete(id);
    },

    listSessions(eventId: string) {
      return sessions.listByEvent(eventId);
    },

    async addCommittee(
      eventId: string,
      data: { userId: string; eventRole: string; positionId?: string | null },
    ) {
      await getEvent(eventId);
      if (!(await users.findById(data.userId))) {
        throw new AppError("User not found", 404);
      }
      if (data.positionId && !(await positions.findById(data.positionId))) {
        throw new AppError("Position not found", 404);
      }
      if (await committees.findByUser(eventId, data.userId)) {
        throw new AppError("User is already a committee member of this event", 409);
      }
      return committees.add({
        eventId,
        userId: data.userId,
        eventRole: data.eventRole,
        positionId: data.positionId ?? null,
      });
    },

    async removeCommittee(id: string) {
      const committee = await committees.findById(id);
      if (!committee) {
        throw new AppError("Committee member not found", 404);
      }
      return committees.remove(id);
    },

    listCommittees(eventId: string) {
      return committees.listByEvent(eventId);
    },

    listMyCommittees(userId: string) {
      return committees.listByUser(userId);
    },

    async setAttendance(sessionId: string, records: AttendanceRecord[]) {
      await getSession(sessionId);
      const saved = [];
      for (const record of records) {
        if (!(await users.findById(record.userId))) {
          throw new AppError("User not found", 404);
        }
        const existing = await attendances.findBySessionUser(sessionId, record.userId);
        if (existing) {
          saved.push(
            await attendances.update(existing.id, {
              status: record.status,
              checkedInAt: record.checkedInAt ?? null,
              note: record.note ?? null,
            }),
          );
        } else {
          saved.push(
            await attendances.create({
              sessionId,
              userId: record.userId,
              status: record.status,
              checkedInAt: record.checkedInAt ?? null,
              note: record.note ?? null,
            }),
          );
        }
      }
      return saved;
    },

    listSessionAttendance(sessionId: string) {
      return attendances.listBySession(sessionId);
    },

    listMyAttendance(userId: string) {
      return attendances.listByUser(userId);
    },

    async recordEventExpense(eventId: string, input: EventExpenseInput) {
      const event = await getEvent(eventId);
      if (event.scope === "GEDUNG" && event.buildingId) {
        const category = await cash.getCategory(input.categoryId);
        if (category.buildingId !== event.buildingId) {
          throw new AppError("Expense category belongs to another building", 400);
        }
      }
      return cash.recordExpense({ ...input, eventId });
    },

    async attachDocument(
      eventId: string,
      data: { fileId: string; kind: "PROPOSAL" | "NOTULEN" | "LPJ" | "FOTO" | "OTHER"; note?: string | null },
    ) {
      await getEvent(eventId);
      if (!(await files.findById(data.fileId))) {
        throw new AppError("File not found", 404);
      }
      return attachments.attach({
        eventId,
        fileId: data.fileId,
        kind: data.kind,
        note: data.note ?? null,
      });
    },

    async removeAttachment(id: string) {
      const attachment = await attachments.findById(id);
      if (!attachment) {
        throw new AppError("Attachment not found", 404);
      }
      return attachments.remove(id);
    },

    listAttachments(eventId: string) {
      return attachments.listByEvent(eventId);
    },
  };
};

export type EventService = ReturnType<typeof createEventService>;
