import assert from "node:assert/strict";
import { test } from "node:test";
import { createFacilityService } from "./service.ts";

type Fakes = {
  roomFindById?: (id: string) => Promise<unknown>;
  facilityFindById?: (id: string) => Promise<unknown>;
  findByCode?: (code: string) => Promise<unknown>;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    facilities: {
      create: async (data: Record<string, unknown>) => ({ id: "f1", ...data }),
      findById: fakes.facilityFindById ?? (async () => ({ id: "f1", scope: "ROOM" })),
      findByCode: fakes.findByCode ?? (async () => null),
      list: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id }),
    },
    roomFacilities: {
      replaceForRoom: async () => [{ id: "rf1" }],
      listByRoom: async () => [{ id: "rf1" }],
      listByFacility: async () => [],
    },
    rooms: {
      findById: fakes.roomFindById ?? (async () => ({ id: "r1", buildingId: "b1" })),
    },
  };
  return createFacilityService(deps as never);
};

const input = {
  code: "MEJA",
  name: "Meja",
  scope: "ROOM" as const,
  usageMode: "SHARED" as const,
  category: "FURNITURE" as const,
};

test("createFacility rejects a duplicate code with 409", async () => {
  const service = makeService({ findByCode: async () => ({ id: "f1" }) });

  await assert.rejects(
    () => service.createFacility(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("createFacility passes through with valid input", async () => {
  const service = makeService();

  const created = await service.createFacility(input);

  assert.equal(created.code, "MEJA");
});

test("setRoomFacilities rejects a missing room with 404", async () => {
  const service = makeService({ roomFindById: async () => null });

  await assert.rejects(
    () => service.setRoomFacilities("missing", [{ facilityId: "f1", quantity: 1 }]),
    (err: { status?: number }) => err.status === 404,
  );
});

test("setRoomFacilities rejects a non-ROOM facility with 400", async () => {
  const service = makeService({
    facilityFindById: async () => ({ id: "f1", scope: "PUBLIC" }),
  });

  await assert.rejects(
    () => service.setRoomFacilities("r1", [{ facilityId: "f1", quantity: 1 }]),
    (err: { status?: number }) => err.status === 400,
  );
});

test("setRoomFacilities rejects quantity <= 0 with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.setRoomFacilities("r1", [{ facilityId: "f1", quantity: 0 }]),
    (err: { status?: number }) => err.status === 400,
  );
});

test("setRoomFacilities passes through with valid items", async () => {
  const service = makeService();

  const result = await service.setRoomFacilities("r1", [{ facilityId: "f1", quantity: 2 }]);

  assert.equal(result.length, 1);
});
