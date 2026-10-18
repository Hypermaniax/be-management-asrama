import assert from "node:assert/strict";
import { test } from "node:test";
import { createBillingService } from "./service.ts";

type Outstanding = {
  id: string;
  buildingId: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: Date;
};

type Fakes = {
  building?: unknown;
  feeRule?: unknown;
  active?: unknown[];
  existingInvoice?: unknown;
  existingPayment?: unknown;
  user?: unknown;
  outstanding?: Outstanding[];
  invoice?: unknown;
  cashAccount?: unknown;
};

const future = new Date("2099-01-01");

const makeService = (fakes: Fakes = {}) => {
  const recorded: {
    data: Record<string, unknown>;
    allocations: { invoiceId: string; amount: number }[];
    updates: { id: string; paidAmount: number; status: string }[];
  }[] = [];
  const ledgerPosted: Record<string, unknown>[] = [];

  const deps = {
    invoices: {
      create: async (data: Record<string, unknown>) => ({ id: "i1", ...data }),
      findById: async () =>
        fakes.invoice === undefined
          ? { id: "i1", status: "ISSUED", paidAmount: 0 }
          : fakes.invoice,
      findActiveByUserPeriod: async () => fakes.existingInvoice ?? null,
      listOutstandingByUser: async () => fakes.outstanding ?? [],
      list: async () => [],
      updatePaymentState: async () => ({}),
      void: async (id: string) => ({ id, status: "VOID" }),
    },
    payments: {
      record: async (
        data: Record<string, unknown>,
        allocations: { invoiceId: string; amount: number }[],
        updates: { id: string; paidAmount: number; status: string }[],
      ) => {
        recorded.push({ data, allocations, updates });
        return { id: "p1", ...data, allocations };
      },
      findById: async () => ({ id: "p1" }),
      findByIdempotencyKey: async () => fakes.existingPayment ?? null,
      list: async () => [],
    },
    occupancies: {
      listActiveByBuilding: async () =>
        fakes.active ?? [
          { id: "o1", userId: "u1", monthlyRateSnapshot: 350000, room: { buildingId: "b1" } },
        ],
    },
    feeRules: {
      findActiveForBuilding: async () =>
        fakes.feeRule === undefined ? { dueDayOfMonth: 10 } : fakes.feeRule,
    },
    buildings: {
      findById: async () => (fakes.building === undefined ? { id: "b1" } : fakes.building),
    },
    users: {
      findById: async () =>
        fakes.user === undefined ? { id: "u1", buildingId: "b1" } : fakes.user,
    },
    cashAccounts: {
      findById: async () =>
        fakes.cashAccount === undefined
          ? { id: "ca1", buildingId: "b1" }
          : fakes.cashAccount,
      findByBuildingId: async () =>
        fakes.cashAccount === undefined
          ? { id: "ca1", buildingId: "b1" }
          : fakes.cashAccount,
    },
    categories: {
      findByName: async () => ({ id: "cat1", kind: "INCOME", buildingId: "b1" }),
      list: async () => [{ id: "cat1", kind: "INCOME", buildingId: "b1" }],
    },
    ledger: {
      create: async (data: Record<string, unknown>) => {
        ledgerPosted.push(data);
        return { id: "le1", ...data };
      },
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };
  return { service: createBillingService(deps as never), recorded, ledgerPosted };
};

const paymentInput = {
  userId: "u1",
  amount: 300000,
  method: "CASH" as const,
  idempotencyKey: "key-1",
};

test("generateMonthly rejects an out-of-range month with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.generateMonthly({ buildingId: "b1", year: 2026, month: 13 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("generateMonthly rejects a missing building with 404", async () => {
  const { service } = makeService({ building: null });

  await assert.rejects(
    () => service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("generateMonthly rejects a building without an active fee rule with 409", async () => {
  const { service } = makeService({ feeRule: null });

  await assert.rejects(
    () => service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("generateMonthly snapshots the occupancy rate into the invoice", async () => {
  const { service } = makeService();

  const created = await service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 });

  assert.equal(created.length, 1);
  assert.equal(created[0].baseAmount, 350000);
  assert.equal(created[0].totalAmount, 350000);
});

test("generateMonthly skips a period that already has an invoice", async () => {
  const { service } = makeService({ existingInvoice: { id: "i0" } });

  const created = await service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 });

  assert.equal(created.length, 0);
});

test("recordPayment rejects a non-positive amount with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.recordPayment({ ...paymentInput, amount: 0 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordPayment rejects a missing user with 404", async () => {
  const { service } = makeService({ user: null });

  await assert.rejects(
    () => service.recordPayment(paymentInput),
    (err: { status?: number }) => err.status === 404,
  );
});

test("recordPayment returns the existing payment for a repeated idempotency key", async () => {
  const { service, recorded } = makeService({ existingPayment: { id: "p0" } });

  const payment = await service.recordPayment(paymentInput);

  assert.equal(payment.id, "p0");
  assert.equal(recorded.length, 0);
});

test("recordPayment auto-allocates across outstanding invoices and settles them", async () => {
  const { service, recorded } = makeService({
    outstanding: [
      { id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future },
      { id: "i2", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future },
    ],
  });

  await service.recordPayment({ ...paymentInput, amount: 500000 });

  assert.deepEqual(recorded[0].allocations, [
    { invoiceId: "i1", amount: 300000 },
    { invoiceId: "i2", amount: 200000 },
  ]);
  assert.deepEqual(recorded[0].updates, [
    { id: "i1", paidAmount: 300000, status: "PAID" },
    { id: "i2", paidAmount: 200000, status: "PARTIAL" },
  ]);
});

test("recordPayment rejects an allocation for a non-outstanding invoice with 400", async () => {
  const { service } = makeService({ outstanding: [] });

  await assert.rejects(
    () =>
      service.recordPayment({
        ...paymentInput,
        allocations: [{ invoiceId: "ghost", amount: 1000 }],
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordPayment rejects an allocation above the invoice remaining with 400", async () => {
  const { service } = makeService({
    outstanding: [
      { id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 250000, dueDate: future },
    ],
  });

  await assert.rejects(
    () =>
      service.recordPayment({
        ...paymentInput,
        amount: 100000,
        allocations: [{ invoiceId: "i1", amount: 100000 }],
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordPayment rejects when the building has no cash account with 409", async () => {
  const { service } = makeService({
    outstanding: [{ id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future }],
    cashAccount: null,
  });

  await assert.rejects(
    () => service.recordPayment(paymentInput),
    (err: { status?: number }) => err.status === 409,
  );
});

test("recordPayment posts an IN ledger entry for the payment", async () => {
  const { service, ledgerPosted } = makeService({
    outstanding: [{ id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future }],
  });

  await service.recordPayment(paymentInput);

  assert.equal(ledgerPosted.length, 1);
  assert.equal(ledgerPosted[0].direction, "IN");
  assert.equal(ledgerPosted[0].amount, 300000);
  assert.equal(ledgerPosted[0].sourceType, "PAYMENT");
  assert.equal(ledgerPosted[0].cashAccountId, "ca1");
});

test("voidInvoice rejects a missing invoice with 404", async () => {
  const { service } = makeService({ invoice: null });

  await assert.rejects(
    () => service.voidInvoice("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("voidInvoice rejects an invoice that already has payments with 409", async () => {
  const { service } = makeService({
    invoice: { id: "i1", status: "ISSUED", paidAmount: 1000 },
  });

  await assert.rejects(
    () => service.voidInvoice("i1"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("voidInvoice voids an unpaid invoice", async () => {
  const { service } = makeService();

  const voided = await service.voidInvoice("i1");

  assert.equal(voided.status, "VOID");
});
