import assert from "node:assert/strict";
import { test } from "node:test";
import { createCashService } from "./service.ts";

type Fakes = {
  building?: unknown;
  account?: unknown;
  category?: unknown;
  existingExpense?: unknown;
  entry?: unknown;
  existingReversal?: unknown;
  balance?: { totalIn: number; totalOut: number };
};

const makeService = (fakes: Fakes = {}) => {
  const ledgerPosted: Record<string, unknown>[] = [];
  const expensesCreated: Record<string, unknown>[] = [];

  const deps = {
    cashAccounts: {
      create: async (data: Record<string, unknown>) => ({ id: "ca1", ...data }),
      findById: async () =>
        fakes.account === undefined ? { id: "ca1", buildingId: "b1" } : fakes.account,
      findByBuildingId: async () =>
        fakes.account === undefined ? { id: "ca1", buildingId: "b1" } : fakes.account,
      list: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    categories: {
      create: async (data: Record<string, unknown>) => ({ id: "cat1", ...data }),
      findById: async () =>
        fakes.category === undefined
          ? { id: "cat1", kind: "EXPENSE", buildingId: "b1" }
          : fakes.category,
      findByName: async () => null,
      list: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    expenses: {
      create: async (data: Record<string, unknown>) => {
        expensesCreated.push(data);
        return { id: "ex1", ...data };
      },
      findById: async () => ({ id: "ex1" }),
      findByIdempotencyKey: async () => fakes.existingExpense ?? null,
      list: async () => [],
    },
    ledger: {
      create: async (data: Record<string, unknown>) => {
        ledgerPosted.push(data);
        return { id: "le1", ...data };
      },
      findById: async () =>
        fakes.entry === undefined
          ? {
              id: "le1",
              cashAccountId: "ca1",
              direction: "OUT",
              amount: 50000,
              categoryId: "cat1",
              sourceType: "EXPENSE",
            }
          : fakes.entry,
      findBySource: async () => fakes.existingReversal ?? null,
      findByIdempotencyKey: async () => null,
      listByAccount: async () => [],
      list: async () => [],
      sumByAccount: async () => fakes.balance ?? { totalIn: 0, totalOut: 0 },
    },
    buildings: {
      findById: async () => (fakes.building === undefined ? { id: "b1" } : fakes.building),
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };

  return {
    service: createCashService(deps as never),
    ledgerPosted,
    expensesCreated,
  };
};

const expenseInput = {
  categoryId: "cat1",
  amount: 50000,
  occurredAt: new Date("2026-10-01"),
  receiptFileId: "file1",
  idempotencyKey: "exp-1",
};

test("createCashAccount rejects a missing building with 404", async () => {
  const { service } = makeService({ building: null });

  await assert.rejects(
    () => service.createCashAccount({ buildingId: "b1", name: "Kas" }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("createCashAccount rejects a building that already has an account with 409", async () => {
  const { service } = makeService({ account: { id: "ca1", buildingId: "b1" } });

  await assert.rejects(
    () => service.createCashAccount({ buildingId: "b1", name: "Kas" }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("recordExpense rejects a non-positive amount with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.recordExpense({ ...expenseInput, amount: 0 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordExpense rejects a category of the wrong kind with 400", async () => {
  const { service } = makeService({
    category: { id: "cat1", kind: "INCOME", buildingId: "b1" },
  });

  await assert.rejects(
    () => service.recordExpense(expenseInput),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordExpense rejects a missing category with 404", async () => {
  const { service } = makeService({ category: null });

  await assert.rejects(
    () => service.recordExpense(expenseInput),
    (err: { status?: number }) => err.status === 404,
  );
});

test("recordExpense creates the expense and posts an OUT ledger entry", async () => {
  const { service, ledgerPosted, expensesCreated } = makeService();

  const expense = await service.recordExpense(expenseInput);

  assert.equal(expense.id, "ex1");
  assert.equal(expensesCreated.length, 1);
  assert.equal(ledgerPosted.length, 1);
  assert.equal(ledgerPosted[0].direction, "OUT");
  assert.equal(ledgerPosted[0].amount, 50000);
  assert.equal(ledgerPosted[0].sourceType, "EXPENSE");
  assert.equal(ledgerPosted[0].sourceId, "ex1");
});

test("recordExpense is idempotent by key", async () => {
  const { service, ledgerPosted } = makeService({
    existingExpense: { id: "ex0" },
  });

  const expense = await service.recordExpense(expenseInput);

  assert.equal(expense.id, "ex0");
  assert.equal(ledgerPosted.length, 0);
});

test("recordManualIncome posts an IN ledger entry with ADJUSTMENT source", async () => {
  const { service, ledgerPosted } = makeService({
    category: { id: "cat1", kind: "INCOME", buildingId: "b1" },
  });

  await service.recordManualIncome({
    categoryId: "cat1",
    amount: 1000000,
    idempotencyKey: "inc-1",
    description: "Bantuan pemerintah",
  });

  assert.equal(ledgerPosted[0].direction, "IN");
  assert.equal(ledgerPosted[0].sourceType, "ADJUSTMENT");
});

test("reverseLedgerEntry rejects a missing entry with 404", async () => {
  const { service } = makeService({ entry: null });

  await assert.rejects(
    () => service.reverseLedgerEntry("missing", "salah"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("reverseLedgerEntry rejects reversing a reversal with 409", async () => {
  const { service } = makeService({
    entry: {
      id: "le1",
      cashAccountId: "ca1",
      direction: "IN",
      amount: 1000,
      categoryId: "cat1",
      sourceType: "REVERSAL",
    },
  });

  await assert.rejects(
    () => service.reverseLedgerEntry("le1", "salah"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("reverseLedgerEntry rejects an already reversed entry with 409", async () => {
  const { service } = makeService({ existingReversal: { id: "rev1" } });

  await assert.rejects(
    () => service.reverseLedgerEntry("le1", "salah"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("reverseLedgerEntry posts the opposite entry with a reason", async () => {
  const { service, ledgerPosted } = makeService();

  await service.reverseLedgerEntry("le1", "salah input");

  assert.equal(ledgerPosted[0].direction, "IN");
  assert.equal(ledgerPosted[0].amount, 50000);
  assert.equal(ledgerPosted[0].sourceType, "REVERSAL");
  assert.equal(ledgerPosted[0].sourceId, "le1");
  assert.match(String(ledgerPosted[0].description), /salah input/);
});

test("getBalance combines opening balance with ledger sums", async () => {
  const { service } = makeService({
    account: { id: "ca1", buildingId: "b1", openingBalance: 200000 },
    balance: { totalIn: 500000, totalOut: 150000 },
  });

  const result = await service.getBalance("ca1");

  assert.deepEqual(result, {
    cashAccountId: "ca1",
    openingBalance: 200000,
    totalIn: 500000,
    totalOut: 150000,
    balance: 550000,
  });
});
