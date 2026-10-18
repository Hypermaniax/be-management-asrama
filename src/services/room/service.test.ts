import assert from "node:assert/strict";
import { test } from "node:test";
import { createRoomService } from "./service.ts";

type Fakes = {
  findById?: (id: string) => Promise<unknown>;
  findByNumber?: (buildingId: string, number: string) => Promise<unknown>;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    rooms: {
      create: async (data: Record<string, unknown>) => ({ id: "r1", ...data }),
      findById: fakes.findById ?? (async () => null),
      findByNumber: fakes.findByNumber ?? (async () => null),
      findByBuilding: async () => [],
      list: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    buildings: {
      findById: async () => ({ id: "b1", code: "G1" }),
    },
  };
  return createRoomService(deps as never);
};

const input = {
  buildingId: "b1",
  number: "101",
  capacity: 4,
};

test("createRoom rejects a duplicate number with 409", async () => {
  const service = makeService({ findByNumber: async () => ({ id: "r1" }) });

  await assert.rejects(
    () => service.createRoom(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("createRoom rejects a missing building with 404", async () => {
  const deps = {
    rooms: {
      create: async (data: Record<string, unknown>) => ({ id: "r1", ...data }),
      findById: async () => null,
      findByNumber: async () => null,
      findByBuilding: async () => [],
      list: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id }),
    },
    buildings: { findById: async () => null },
  };
  const service = createRoomService(deps as never);

  await assert.rejects(
    () => service.createRoom(input),
    (err: { status?: number }) => err.status === 404,
  );
});

test("createRoom rejects capacity <= 0 with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.createRoom({ ...input, capacity: 0 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createRoom passes through with valid input", async () => {
  const service = makeService();

  const created = await service.createRoom(input);

  assert.equal(created.number, "101");
  assert.equal(created.capacity, 4);
});

test("updateRoom rejects a missing room with 404", async () => {
  const service = makeService({ findById: async () => null });

  await assert.rejects(
    () => service.updateRoom("missing", { capacity: 2 }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("softDeleteRoom rejects a missing room with 404", async () => {
  const service = makeService({ findById: async () => null });

  await assert.rejects(
    () => service.softDeleteRoom("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});
