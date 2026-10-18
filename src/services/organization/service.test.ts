import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrganizationService } from "./service.ts";

type Fakes = {
  period?: unknown;
  existingPeriod?: unknown;
  position?: unknown;
  existingPosition?: unknown;
  role?: unknown;
  building?: unknown;
  user?: unknown;
  assignment?: unknown;
  positionAssignments?: unknown[];
  periodAssignments?: unknown[];
  positionList?: unknown[];
};

const makeService = (fakes: Fakes = {}) => {
  const created: Record<string, unknown>[] = [];
  const activated: string[] = [];
  const ended: { id: string; endDate: Date }[] = [];

  const deps = {
    periods: {
      create: async (data: Record<string, unknown>) => ({ id: "p1", ...data }),
      findById: async () =>
        fakes.period === undefined
          ? { id: "p1", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") }
          : fakes.period,
      findByCode: async () => fakes.existingPeriod ?? null,
      list: async () => [],
      findActive: async () => null,
      activate: async (id: string) => {
        activated.push(id);
        return { id, isActive: true };
      },
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    positions: {
      create: async (data: Record<string, unknown>) => ({ id: "pos1", ...data }),
      findById: async () =>
        fakes.position === undefined
          ? { id: "pos1", code: "KETUA", buildingId: null, role: null }
          : fakes.position,
      findByCode: async () => fakes.existingPosition ?? null,
      list: async () => fakes.positionList ?? [],
      listByBuilding: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    positionAssignments: {
      create: async (data: Record<string, unknown>) => {
        created.push(data);
        return { id: "pa1", ...data };
      },
      findById: async () =>
        fakes.assignment === undefined ? { id: "pa1", isActive: true } : fakes.assignment,
      findActiveByUser: async () => [],
      listByUser: async () => [],
      listByPeriod: async () => fakes.periodAssignments ?? [],
      listByPosition: async () => fakes.positionAssignments ?? [],
      end: async (id: string, endDate: Date) => {
        ended.push({ id, endDate });
        return { id, isActive: false, endDate };
      },
    },
    roles: {
      findById: async () => (fakes.role === undefined ? { id: "r1" } : fakes.role),
    },
    buildings: {
      findById: async () => (fakes.building === undefined ? { id: "b1" } : fakes.building),
    },
    users: {
      findById: async () => (fakes.user === undefined ? { id: "u1" } : fakes.user),
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };

  return {
    service: createOrganizationService(deps as never),
    created,
    activated,
    ended,
  };
};

const periodInput = {
  code: "2025-2026",
  name: "Periode 2025/2026",
  startDate: new Date("2025-09-01"),
  endDate: new Date("2026-08-31"),
};

test("createPeriod rejects a duplicate code with 409", async () => {
  const { service } = makeService({ existingPeriod: { id: "p0" } });

  await assert.rejects(
    () => service.createPeriod(periodInput),
    (err: { status?: number }) => err.status === 409,
  );
});

test("createPeriod rejects an endDate before startDate with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () =>
      service.createPeriod({
        ...periodInput,
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-08-31"),
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("activatePeriod activates the period (deactivating others via repo)", async () => {
  const { service, activated } = makeService();

  const period = await service.activatePeriod("p1");

  assert.equal(period.isActive, true);
  assert.deepEqual(activated, ["p1"]);
});

test("createPosition rejects a missing role with 404", async () => {
  const { service } = makeService({ role: null });

  await assert.rejects(
    () => service.createPosition({ code: "KETUA", name: "Ketua", roleId: "missing" }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("createPosition rejects a duplicate code in the same scope with 409", async () => {
  const { service } = makeService({ existingPosition: { id: "pos0" } });

  await assert.rejects(
    () => service.createPosition({ code: "KETUA", name: "Ketua" }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("assignPosition derives building scope from a building-scoped position", async () => {
  const { service, created } = makeService({
    position: { id: "pos1", code: "KOOR_GEDUNG", buildingId: "b2", role: null },
  });

  await service.assignPosition({
    periodId: "p1",
    positionId: "pos1",
    userId: "u1",
    startDate: new Date("2026-01-01"),
  });

  assert.equal(created[0].buildingId, "b2");
  assert.equal(created[0].periodId, "p1");
});

test("assignPosition rejects a duplicate active assignment with 409", async () => {
  const { service } = makeService({
    positionAssignments: [{ id: "pa0", periodId: "p1", userId: "u1", isActive: true }],
  });

  await assert.rejects(
    () =>
      service.assignPosition({
        periodId: "p1",
        positionId: "pos1",
        userId: "u1",
        startDate: new Date("2026-01-01"),
      }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("assignPosition rejects a missing user with 404", async () => {
  const { service } = makeService({ user: null });

  await assert.rejects(
    () =>
      service.assignPosition({
        periodId: "p1",
        positionId: "pos1",
        userId: "missing",
        startDate: new Date("2026-01-01"),
      }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("endAssignment rejects a missing assignment with 404", async () => {
  const { service } = makeService({ assignment: null });

  await assert.rejects(
    () => service.endAssignment("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("endAssignment ends an active assignment", async () => {
  const { service, ended } = makeService();

  const result = await service.endAssignment("pa1", new Date("2026-06-01"));

  assert.equal(result.isActive, false);
  assert.equal(ended.length, 1);
});

test("getStructure groups active holders under their position", async () => {
  const { service } = makeService({
    positionList: [{ id: "pos1", name: "Ketua", buildingId: null }],
    periodAssignments: [
      {
        id: "pa1",
        positionId: "pos1",
        userId: "u1",
        isActive: true,
        user: { id: "u1", name: "Budi" },
        buildingId: null,
        startDate: new Date("2026-01-01"),
        endDate: null,
        decreeNumber: null,
      },
      {
        id: "pa2",
        positionId: "pos1",
        userId: "u2",
        isActive: false,
        user: { id: "u2", name: "Lama" },
      },
    ],
  });

  const structure = await service.getStructure("p1");

  assert.equal(structure.positions.length, 1);
  assert.equal(structure.positions[0].holders.length, 1);
  assert.equal(structure.positions[0].holders[0].userId, "u1");
});
