import assert from "node:assert/strict";
import { test } from "node:test";
import { createResidentService } from "./service.ts";

type Fakes = {
  findById?: (id: string) => Promise<unknown>;
  residentRole?: unknown;
};

const makeService = (fakes: Fakes = {}) => {
  const assignedRoles: { userId: string; roleId: string }[] = [];
  const deps = {
    users: {
      findById: fakes.findById ?? (async () => ({ id: "u1", status: "PENDING", buildingId: null })),
      updateProfile: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      setStatus: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      listByBuilding: async () => [],
    },
    roles: {
      findByCode: async () =>
        fakes.residentRole === undefined ? { id: "r-penghuni", code: "PENGHUNI" } : fakes.residentRole,
    },
    userRoles: {
      assign: async (data: { userId: string; roleId: string }) => {
        assignedRoles.push(data);
        return { id: "ur1", ...data };
      },
    },
  };
  return { service: createResidentService(deps as never), assignedRoles };
};

test("getResident rejects a missing user with 404", async () => {
  const { service } = makeService({ findById: async () => null });

  await assert.rejects(
    () => service.getResident("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("approve transitions PENDING to ACTIVE and grants the PENGHUNI role", async () => {
  const { service, assignedRoles } = makeService();

  const result = await service.approve("u1", "admin1", "b1");

  assert.equal(result.status, "ACTIVE");
  assert.equal(result.reviewedById, "admin1");
  assert.deepEqual(assignedRoles, [{ userId: "u1", roleId: "r-penghuni" }]);
});

test("approve still succeeds when the PENGHUNI role is missing", async () => {
  const { service, assignedRoles } = makeService({ residentRole: null });

  const result = await service.approve("u1", "admin1");

  assert.equal(result.status, "ACTIVE");
  assert.deepEqual(assignedRoles, []);
});

test("approve rejects a non-PENDING user with 400", async () => {
  const { service } = makeService({
    findById: async () => ({ id: "u1", status: "ACTIVE", buildingId: "b1" }),
  });

  await assert.rejects(
    () => service.approve("u1", "admin1"),
    (err: { status?: number }) => err.status === 400,
  );
});

test("reject rejects a non-PENDING user with 400", async () => {
  const { service } = makeService({
    findById: async () => ({ id: "u1", status: "ACTIVE", buildingId: "b1" }),
  });

  await assert.rejects(
    () => service.reject("u1", "admin1", "bad docs"),
    (err: { status?: number }) => err.status === 400,
  );
});

test("checkout rejects a non-ACTIVE user with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.checkout("u1"),
    (err: { status?: number }) => err.status === 400,
  );
});

test("checkout transitions ACTIVE to CHECKOUT", async () => {
  const { service } = makeService({
    findById: async () => ({ id: "u1", status: "ACTIVE", buildingId: "b1" }),
  });

  const result = await service.checkout("u1");

  assert.equal(result.status, "CHECKOUT");
});
