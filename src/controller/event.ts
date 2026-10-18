import type { Request, Response } from "express";
import { eventService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { permissionCode } from "../lib/permission.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import { recordExpenseSchema } from "../validations/cash.ts";
import {
  attachmentSchema,
  attendanceSchema,
  committeeSchema,
  eventSchema,
  generateSessionsSchema,
  listEventQuerySchema,
  sessionSchema,
  statusSchema,
  updateEventSchema,
} from "../validations/event.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

const scopeBuildingIds = (req: Request): string[] | undefined => {
  const { scope } = req as ScopedRequest;
  if (scope && "buildingIds" in scope) {
    return scope.buildingIds;
  }
  return undefined;
};

const isPrivileged = (req: Request): boolean => {
  const { access } = req as AccessRequest;
  if (!access) return false;
  return access.isSuperAdmin || access.permissions.has(permissionCode("event", "UPDATE"));
};

const assertEventVisible = (req: Request, event: { isPublic: boolean; buildingId: string | null }) => {
  const { access, scope } = req as ScopedRequest;
  if (!isPrivileged(req) && !event.isPublic) {
    throw new AppError("Forbidden", 403);
  }
  if (
    access &&
    !access.isSuperAdmin &&
    event.buildingId &&
    scope &&
    "buildingIds" in scope &&
    !scope.buildingIds.includes(event.buildingId)
  ) {
    throw new AppError("Forbidden", 403);
  }
};

const resolvedBuilding = (data: {
  scope?: "ASRAMA" | "GEDUNG";
  buildingId?: string | null;
}): string | null => {
  const scope = data.scope ?? (data.buildingId ? "GEDUNG" : "ASRAMA");
  return scope === "GEDUNG" ? (data.buildingId ?? null) : null;
};

export const eventController = {
  async create(req: Request, res: Response) {
    const data = eventSchema.parse(req.body);
    assertBuildingAccess(req, resolvedBuilding(data));
    const event = await eventService.createEvent({
      ...data,
      createdById: (req as AccessRequest).user!.id,
    });
    res.status(201).json({ status: "event created", data: event });
  },

  async list(req: Request, res: Response) {
    const filters = listEventQuerySchema.parse(req.query);
    const data = await eventService.listEvents(scopeBuildingIds(req), {
      ...filters,
      publicOnly: !isPrivileged(req),
    });
    res.json({ status: "ok", data });
  },

  async detail(req: Request, res: Response) {
    const event = await eventService.getEvent(paramId(req.params.id));
    assertEventVisible(req, event);
    const data = await eventService.getEventDetail(event.id);
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updateEventSchema.parse(req.body);
    if (data.buildingId !== undefined) {
      assertBuildingAccess(req, resolvedBuilding(data));
    }
    const event = await eventService.updateEvent(id, data);
    res.json({ status: "event updated", data: event });
  },

  async changeStatus(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const { status } = statusSchema.parse(req.body);
    const event = await eventService.changeStatus(id, status);
    res.json({ status: "event status updated", data: event });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    await eventService.deleteEvent(id);
    res.json({ status: "event deleted" });
  },

  async addSession(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = sessionSchema.parse(req.body);
    const session = await eventService.addSession(id, data);
    res.status(201).json({ status: "session created", data: session });
  },

  async generateSessions(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const { dates } = generateSessionsSchema.parse(req.body);
    const data = await eventService.generateSessions(id, dates);
    res.status(201).json({ status: "sessions generated", data });
  },

  async listSessions(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertEventVisible(req, existing);
    const data = await eventService.listSessions(id);
    res.json({ status: "ok", data });
  },

  async removeSession(req: Request, res: Response) {
    await eventService.deleteSession(paramId(req.params.sessionId));
    res.json({ status: "session deleted" });
  },

  async setAttendance(req: Request, res: Response) {
    const { records } = attendanceSchema.parse(req.body);
    const data = await eventService.setAttendance(paramId(req.params.sessionId), records);
    res.json({ status: "attendance saved", data });
  },

  async listAttendance(req: Request, res: Response) {
    const data = await eventService.listSessionAttendance(paramId(req.params.sessionId));
    res.json({ status: "ok", data });
  },

  async addCommittee(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = committeeSchema.parse(req.body);
    const committee = await eventService.addCommittee(id, data);
    res.status(201).json({ status: "committee added", data: committee });
  },

  async listCommittees(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertEventVisible(req, existing);
    const data = await eventService.listCommittees(id);
    res.json({ status: "ok", data });
  },

  async removeCommittee(req: Request, res: Response) {
    await eventService.removeCommittee(paramId(req.params.committeeId));
    res.json({ status: "committee removed" });
  },

  async myCommittees(req: Request, res: Response) {
    const data = await eventService.listMyCommittees((req as AccessRequest).user!.id);
    res.json({ status: "ok", data });
  },

  async recordExpense(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = recordExpenseSchema.parse(req.body);
    const expense = await eventService.recordEventExpense(id, {
      ...data,
      createdById: (req as AccessRequest).user!.id,
    });
    res.status(201).json({ status: "event expense recorded", data: expense });
  },

  async attach(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = attachmentSchema.parse(req.body);
    const attachment = await eventService.attachDocument(id, data);
    res.status(201).json({ status: "attachment added", data: attachment });
  },

  async listAttachments(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await eventService.getEvent(id);
    assertEventVisible(req, existing);
    const data = await eventService.listAttachments(id);
    res.json({ status: "ok", data });
  },

  async removeAttachment(req: Request, res: Response) {
    await eventService.removeAttachment(paramId(req.params.attachmentId));
    res.json({ status: "attachment removed" });
  },

  async myAttendance(req: Request, res: Response) {
    const data = await eventService.listMyAttendance((req as AccessRequest).user!.id);
    res.json({ status: "ok", data });
  },
};
