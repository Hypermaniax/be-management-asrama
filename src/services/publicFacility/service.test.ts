import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicFacilityService } from "./service.ts";

type Fakes = {
  pfFindById?: (id: string) => Promise<unknown>;
  buildingFindById?: (id: string) => Promise<unknown>;
  facilityFindById?: (id: string) => Promise<unknown>;
  slotTaken?: boolean;
  userHasFacility?: boolean;
  assignmentFindById?: (id: string) => Promise<unknown>;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    publicFacilities: {
      create: async (data: Record<string, unknown>) => ({ id: "pf1", ...data }),
      findById:
        fakes.pfFindById ??
        (async () => ({ id: "pf1", buildingId: "b1", facilityId: "f1", facility: { usageMode: "ASSIGNED" } })),
      findByBuildingFacilityNumber: async () => null,
      list: async () => [],
      listByBuilding: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id }),
    },
    assignments: {
      create: async (data: Record<string, unknown>) => ({ id: "a1", ...data }),
      findById: fakes.assignmentFindById ?? (async () => null),
      findActiveBySlot: async () => (fakes.slotTaken ? { id: "a1" } : null),
      findActiveByUserFacility: async () => (fakes.userHasFacility ? { id: "a2" } : null),
      listByUser: async () => [],
      listByPublicFacility: async () => [],
      softDelete: async (id: string) => ({ id }),
    },
    buildings: {
      findById: fakes.buildingFindById ?? (async () => ({ id: "b1" })),
    },
    facilities: {
      findById: fakes.facilityFindById ?? (async () => ({ id: "f1", usageMode: "ASSIGNED" })),
    },
  };
  return createPublicFacilityService(deps as never);
};

test("createPublicFacility rejects ASSIGNED facility without number with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.createPublicFacility({ buildingId: "b1", facilityId: "f1" }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createPublicFacility rejects a missing building with 404", async () => {
  const service = makeService({ buildingFindById: async () => null });

  await assert.rejects(
    () => service.createPublicFacility({ buildingId: "x", facilityId: "f1", number: "KM1" }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("assign rejects a missing public facility with 404", async () => {
  const service = makeService({ pfFindById: async () => null });

  await assert.rejects(
    () => service.assign("missing", "u1", "A"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("assign rejects a non-ASSIGNED facility with 400", async () => {
  const service = makeService({
    pfFindById: async () => ({
      id: "pf1",
      buildingId: "b1",
      facilityId: "f1",
      facility: { usageMode: "SHARED" },
    }),
  });

  await assert.rejects(
    () => service.assign("pf1", "u1", "A"),
    (err: { status?: number }) => err.status === 400,
  );
});

test("assign rejects a taken slot with 409", async () => {
  const service = makeService({ slotTaken: true });

  await assert.rejects(
    () => service.assign("pf1", "u1", "A"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("assign rejects when user already has the facility type with 409", async () => {
  const service = makeService({ userHasFacility: true });

  await assert.rejects(
    () => service.assign("pf1", "u1", "A"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("assign passes through with valid input", async () => {
  const service = makeService();

  const created = await service.assign("pf1", "u1", "A");

  assert.equal(created.slotLabel, "A");
  assert.equal(created.facilityId, "f1");
});

test("getAssignment rejects a missing assignment with 404", async () => {
  const service = makeService({ assignmentFindById: async () => null });

  await assert.rejects(
    () => service.getAssignment("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});
