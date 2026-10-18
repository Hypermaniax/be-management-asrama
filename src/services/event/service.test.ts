import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventService } from "./service.ts";

type Fakes = {
  event?: unknown;
  session?: unknown;
  committee?: unknown;
  existingCommittee?: unknown;
  existingSession?: unknown;
  existingAttendance?: unknown;
  building?: unknown;
  user?: unknown;
  position?: unknown;
  file?: unknown;
  category?: unknown;
  eventAttendances?: unknown[];
};

const makeService = (fakes: Fakes = {}) => {
  const eventsCreated: Record<string, unknown>[] = [];
  const sessionsCreated: Record<string, unknown>[] = [];
  const statusSet: unknown[] = [];
  const attendancesSaved: Record<string, unknown>[] = [];
  const cashExpenses: Record<string, unknown>[] = [];

  const deps = {
    events: {
      create: async (data: Record<string, unknown>) => {
        eventsCreated.push(data);
        return { id: "e1", ...data };
      },
      findById: async () =>
        fakes.event === undefined
          ? { id: "e1", title: "Yasinan", scope: "ASRAMA", buildingId: null, startAt: new Date(), endAt: null, location: null }
          : fakes.event,
      list: async () => [],
      listByBuilding: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      setStatus: async (id: string, status: string) => {
        statusSet.push(status);
        return { id, status };
      },
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    sessions: {
      create: async (data: Record<string, unknown>) => {
        sessionsCreated.push(data);
        return { id: "s1", ...data };
      },
      findById: async () => (fakes.session === undefined ? { id: "s1" } : fakes.session),
      findBySchedule: async () => fakes.existingSession ?? null,
      listByEvent: async () => [],
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    committees: {
      add: async (data: Record<string, unknown>) => ({ id: "c1", ...data }),
      findById: async () => (fakes.committee === undefined ? { id: "c1" } : fakes.committee),
      findByUser: async () => fakes.existingCommittee ?? null,
      listByEvent: async () => [],
      listByUser: async () => [],
      remove: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    attendances: {
      create: async (data: Record<string, unknown>) => {
        attendancesSaved.push(data);
        return { id: "at1", ...data };
      },
      findById: async () => ({ id: "at1" }),
      findBySessionUser: async () => fakes.existingAttendance ?? null,
      update: async (id: string, data: Record<string, unknown>) => {
        attendancesSaved.push({ id, ...data });
        return { id, ...data };
      },
      listBySession: async () => [],
      listByUser: async () => [],
      listByEvent: async () => fakes.eventAttendances ?? [],
    },
    attachments: {
      attach: async (data: Record<string, unknown>) => ({ id: "a1", ...data }),
      findById: async () => (fakes.file === undefined ? { id: "a1" } : { id: "a1" }),
      listByEvent: async () => [],
      remove: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    buildings: {
      findById: async () => (fakes.building === undefined ? { id: "b1" } : fakes.building),
    },
    users: {
      findById: async () => (fakes.user === undefined ? { id: "u1" } : fakes.user),
    },
    positions: {
      findById: async () => (fakes.position === undefined ? { id: "pos1" } : fakes.position),
    },
    files: {
      findById: async () => (fakes.file === undefined ? { id: "f1" } : fakes.file),
    },
    cash: {
      getCategory: async (id: string) =>
        fakes.category === undefined ? { id, buildingId: "b1" } : fakes.category,
      recordExpense: async (input: Record<string, unknown>) => {
        cashExpenses.push(input);
        return { id: "ex1", ...input };
      },
    },
  };

  return {
    service: createEventService(deps as never),
    eventsCreated,
    sessionsCreated,
    statusSet,
    attendancesSaved,
    cashExpenses,
  };
};

const baseEvent = {
  title: "Yasinan",
  startAt: new Date("2026-11-01T20:00:00"),
  createdById: "u1",
};

test("createEvent rejects a GEDUNG event without buildingId with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.createEvent({ ...baseEvent, scope: "GEDUNG" }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createEvent forces buildingId null for an ASRAMA event", async () => {
  const { service, eventsCreated } = makeService();

  await service.createEvent({ ...baseEvent, scope: "ASRAMA", buildingId: "b1" });

  assert.equal(eventsCreated[0].scope, "ASRAMA");
  assert.equal(eventsCreated[0].buildingId, null);
});

test("createEvent auto-creates one session when recurrence is NONE", async () => {
  const { service, sessionsCreated } = makeService();

  await service.createEvent({ ...baseEvent, scope: "ASRAMA" });

  assert.equal(sessionsCreated.length, 1);
  assert.equal(sessionsCreated[0].eventId, "e1");
});

test("createEvent does not auto-create a session for a recurring event", async () => {
  const { service, sessionsCreated } = makeService();

  await service.createEvent({ ...baseEvent, scope: "ASRAMA", recurrence: "WEEKLY" });

  assert.equal(sessionsCreated.length, 0);
});

test("addCommittee rejects a duplicate member with 409", async () => {
  const { service } = makeService({ existingCommittee: { id: "c0" } });

  await assert.rejects(
    () => service.addCommittee("e1", { userId: "u1", eventRole: "Ketua" }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("addCommittee rejects a missing user with 404", async () => {
  const { service } = makeService({ user: null });

  await assert.rejects(
    () => service.addCommittee("e1", { userId: "missing", eventRole: "Ketua" }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("setAttendance creates records for users without one", async () => {
  const { service, attendancesSaved } = makeService();

  await service.setAttendance("s1", [{ userId: "u1", status: "HADIR" }]);

  assert.equal(attendancesSaved.length, 1);
  assert.equal(attendancesSaved[0].status, "HADIR");
  assert.equal(attendancesSaved[0].sessionId, "s1");
});

test("setAttendance updates an existing record", async () => {
  const { service, attendancesSaved } = makeService({
    existingAttendance: { id: "at1" },
  });

  await service.setAttendance("s1", [{ userId: "u1", status: "IZIN" }]);

  assert.equal(attendancesSaved[0].id, "at1");
  assert.equal(attendancesSaved[0].status, "IZIN");
});

test("recordEventExpense delegates to cash with the event id", async () => {
  const { service, cashExpenses } = makeService();

  await service.recordEventExpense("e1", {
    categoryId: "cat1",
    amount: 50000,
    occurredAt: new Date("2026-11-01"),
    receiptFileId: "f1",
    idempotencyKey: "ev-exp-1",
  });

  assert.equal(cashExpenses.length, 1);
  assert.equal(cashExpenses[0].eventId, "e1");
});

test("recordEventExpense rejects a category from another building for a GEDUNG event", async () => {
  const { service } = makeService({
    event: { id: "e1", scope: "GEDUNG", buildingId: "b1" },
    category: { id: "cat1", buildingId: "b2" },
  });

  await assert.rejects(
    () =>
      service.recordEventExpense("e1", {
        categoryId: "cat1",
        amount: 50000,
        occurredAt: new Date("2026-11-01"),
        receiptFileId: "f1",
        idempotencyKey: "ev-exp-2",
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("changeStatus sets the event status", async () => {
  const { service, statusSet } = makeService();

  const event = await service.changeStatus("e1", "DONE");

  assert.equal(event.status, "DONE");
  assert.deepEqual(statusSet, ["DONE"]);
});

test("getEventDetail aggregates the attendance summary", async () => {
  const { service } = makeService({
    eventAttendances: [{ status: "HADIR" }, { status: "HADIR" }, { status: "IZIN" }],
  });

  const detail = await service.getEventDetail("e1");

  assert.deepEqual(detail.attendanceSummary, { HADIR: 2, IZIN: 1, TIDAK: 0 });
});
