import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuildingService } from "./service.ts";

type Fakes = {
  findByCode?: (code: string) => Promise<unknown>;
  findById?: (id: string) => Promise<unknown>;
  list?: () => Promise<unknown[]>;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    buildings: {
      create: async (data: Record<string, unknown>) => ({ id: "b1", ...data }),
      findByCode: fakes.findByCode ?? (async () => null),
      findById: fakes.findById ?? (async () => null),
      list: fakes.list ?? (async () => []),
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
  };
  return createBuildingService(deps as never);
};

const input = {
  code: "G1",
  name: "Gedung Putra",
  gender: "MALE" as const,
  address: "Yogyakarta",
};

test("createBuilding rejects a duplicate code with 409", async () => {
  const service = makeService({ findByCode: async () => ({ id: "b1", code: "G1" }) });

  await assert.rejects(
    () => service.createBuilding(input),
    (err: { status?: number }) => err.status === 409,
  );
});

test("createBuilding passes through when the code is free", async () => {
  const service = makeService();

  const created = await service.createBuilding(input);

  assert.equal(created.code, "G1");
  assert.equal(created.gender, "MALE");
});

test("updateBuilding rejects a missing building with 404", async () => {
  const service = makeService({ findById: async () => null });

  await assert.rejects(
    () => service.updateBuilding("missing", { name: "X" }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("softDeleteBuilding rejects a missing building with 404", async () => {
  const service = makeService({ findById: async () => null });

  await assert.rejects(
    () => service.softDeleteBuilding("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});
