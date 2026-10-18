import assert from "node:assert/strict";
import { test } from "node:test";
import { createOccupancyService } from "./service.ts";

type Fakes = {
  room?: unknown;
  building?: unknown;
  user?: unknown;
  countActive?: number;
  activeByUser?: unknown;
  feeRule?: unknown;
  occupancy?: unknown;
  assigned?: { id: string }[];
};

const makeService = (fakes: Fakes = {}) => {
  const deleted: string[] = [];
  const deps = {
    occupancies: {
      create: async (data: Record<string, unknown>) => ({ id: "o1", ...data }),
      findById: async () =>
        fakes.occupancy === undefined
          ? { id: "o1", userId: "u1", status: "ACTIVE" }
          : fakes.occupancy,
      findActiveByUser: async () => fakes.activeByUser ?? null,
      listActiveByRoom: async () => [],
      countActive: async () => fakes.countActive ?? 0,
      end: async (id: string, endDate: Date) => ({ id, status: "ENDED", endDate }),
      list: async () => [],
    },
    rooms: {
      findById: async () =>
        fakes.room === undefined
          ? { id: "r1", buildingId: "b1", capacity: 4, status: "ACTIVE" }
          : fakes.room,
    },
    buildings: {
      findById: async () =>
        fakes.building === undefined ? { id: "b1", gender: "MALE" } : fakes.building,
    },
    users: {
      findById: async () =>
        fakes.user === undefined
          ? { id: "u1", status: "ACTIVE", gender: "MALE" }
          : fakes.user,
    },
    feeRules: {
      findActiveForBuilding: async () =>
        fakes.feeRule === undefined ? { defaultMonthlyRate: 350000 } : fakes.feeRule,
    },
    assignments: {
      listAssignedByUser: async () => fakes.assigned ?? [],
      softDelete: async (id: string) => {
        deleted.push(id);
        return { id };
      },
    },
    __deleted: deleted,
  };
  return { service: createOccupancyService(deps as never), deleted };
};

const input = { userId: "u1", roomId: "r1" };

test("place rejects a missing room with 404", async () => {
  const { service } = makeService({ room: null });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 404,
  );
});

test("place rejects a non-ACTIVE room with 409", async () => {
  const { service } = makeService({
    room: { id: "r1", buildingId: "b1", capacity: 4, status: "MAINTENANCE" },
  });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("place rejects a non-active user with 409", async () => {
  const { service } = makeService({
    user: { id: "u1", status: "PENDING", gender: "MALE" },
  });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("place rejects a user without gender with 400", async () => {
  const { service } = makeService({
    user: { id: "u1", status: "ACTIVE", gender: null },
  });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 400,
  );
});

test("place rejects a gender mismatch with 409", async () => {
  const { service } = makeService({
    user: { id: "u1", status: "ACTIVE", gender: "FEMALE" },
  });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("place rejects a full room with 409", async () => {
  const { service } = makeService({ countActive: 4 });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("place rejects a user that already has an active occupancy with 409", async () => {
  const { service } = makeService({ activeByUser: { id: "o0" } });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("place rejects a building without an active fee rule with 409", async () => {
  const { service } = makeService({ feeRule: null });

  await assert.rejects(
    () => service.place(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("place snapshots the fee rule rate on success", async () => {
  const { service } = makeService();

  const created = await service.place({ ...input, bedLabel: "A" });

  assert.equal(created.monthlyRateSnapshot, 350000);
  assert.equal(created.bedLabel, "A");
});

test("checkout rejects a missing occupancy with 404", async () => {
  const { service } = makeService({ occupancy: null });

  await assert.rejects(
    () => service.checkout("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("checkout rejects an already ENDED occupancy with 409", async () => {
  const { service } = makeService({
    occupancy: { id: "o1", userId: "u1", status: "ENDED" },
  });

  await assert.rejects(
    () => service.checkout("o1"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("checkout ends the occupancy and releases assigned facilities", async () => {
  const { service, deleted } = makeService({
    assigned: [{ id: "a1" }, { id: "a2" }],
  });

  const ended = await service.checkout("o1");

  assert.equal(ended.status, "ENDED");
  assert.deepEqual(deleted, ["a1", "a2"]);
});
