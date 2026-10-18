import assert from "node:assert/strict";
import { test } from "node:test";
import { createFeeRuleService } from "./service.ts";

type Fakes = {
  findById?: (id: string) => Promise<unknown>;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    feeRules: {
      create: async (data: Record<string, unknown>) => ({ id: "f1", ...data }),
      findById: fakes.findById ?? (async () => null),
      findByBuilding: async () => [],
      findActiveForBuilding: async () => null,
      list: async () => [],
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    buildings: {
      findById: async () => ({ id: "b1", code: "G1" }),
    },
  };
  return createFeeRuleService(deps as never);
};

const input = {
  buildingId: "b1",
  dueDayOfMonth: 10,
  defaultMonthlyRate: 350000,
  effectiveFrom: new Date("2025-01-01"),
};

test("createFeeRule rejects dueDayOfMonth out of 1-28 with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.createFeeRule({ ...input, dueDayOfMonth: 29 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createFeeRule rejects negative rate with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.createFeeRule({ ...input, defaultMonthlyRate: -1 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createFeeRule rejects a missing building with 404", async () => {
  const deps = {
    feeRules: {
      create: async (data: Record<string, unknown>) => ({ id: "f1", ...data }),
      findById: async () => null,
      findByBuilding: async () => [],
      findActiveForBuilding: async () => null,
      list: async () => [],
      softDelete: async (id: string) => ({ id }),
    },
    buildings: { findById: async () => null },
  };
  const service = createFeeRuleService(deps as never);

  await assert.rejects(
    () => service.createFeeRule(input),
    (err: { status?: number }) => err.status === 404,
  );
});

test("createFeeRule passes through with valid input", async () => {
  const service = makeService();

  const created = await service.createFeeRule(input);

  assert.equal(created.defaultMonthlyRate, 350000);
  assert.equal(created.dueDayOfMonth, 10);
});

test("getFeeRule rejects a missing rule with 404", async () => {
  const service = makeService({ findById: async () => null });

  await assert.rejects(
    () => service.getFeeRule("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});
