import assert from "node:assert/strict";
import { test } from "node:test";
import { createReportService } from "./service.ts";

type Fakes = {
  arrears?: unknown[];
  accounts?: unknown[];
  accountSums?: unknown[];
  byDirection?: unknown[];
  byCategory?: unknown[];
  categories?: unknown[];
  event?: unknown;
  eventExpenses?: { _sum: { amount: number | null }; _count: number };
  building?: unknown;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    reports: {
      listArrears: async () => fakes.arrears ?? [],
      listCashAccounts: async () => fakes.accounts ?? [],
      sumLedgerByAccount: async () => fakes.accountSums ?? [],
      sumLedgerByDirection: async () => fakes.byDirection ?? [],
      sumLedgerByCategory: async () => fakes.byCategory ?? [],
      findEvent: async () => fakes.event ?? null,
      sumEventExpenses: async () =>
        fakes.eventExpenses ?? { _sum: { amount: 0 }, _count: 0 },
    },
    categories: {
      list: async () => fakes.categories ?? [],
    },
    buildings: {
      findById: async () => (fakes.building === undefined ? { id: "b1" } : fakes.building),
    },
  };

  return createReportService(deps as never);
};

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: "inv1",
  code: "INV-001",
  userId: "u1",
  buildingId: "b1",
  periodYear: 2026,
  periodMonth: 3,
  dueDate: new Date("2026-03-10"),
  totalAmount: 500000,
  paidAmount: 200000,
  status: "PARTIAL",
  user: { id: "u1", name: "Budi" },
  building: { id: "b1", name: "Gedung 1" },
  ...overrides,
});

test("arrears computes outstanding per invoice and totals", async () => {
  const service = makeService({
    arrears: [
      invoice(),
      invoice({ id: "inv2", code: "INV-002", totalAmount: 300000, paidAmount: 0, status: "ISSUED" }),
    ],
  });

  const report = await service.arrears(["b1"], { year: 2026, month: 3 });

  assert.equal(report.count, 2);
  assert.equal(report.totalOutstanding, 600000);
  assert.equal(report.items[0]?.outstanding, 300000);
  assert.equal(report.items[0]?.userName, "Budi");
  assert.equal(report.year, 2026);
});

test("cashBalances adds opening balance to ledger movements", async () => {
  const service = makeService({
    accounts: [
      {
        id: "acc1",
        name: "Kas Utama",
        type: "CASH",
        buildingId: "b1",
        openingBalance: 100000,
        building: { id: "b1", name: "Gedung 1" },
      },
    ],
    accountSums: [
      { cashAccountId: "acc1", direction: "IN", _sum: { amount: 400000 } },
      { cashAccountId: "acc1", direction: "OUT", _sum: { amount: 150000 } },
      { cashAccountId: "acc-other", direction: "IN", _sum: { amount: 999 } },
    ],
  });

  const report = await service.cashBalances(["b1"]);

  assert.equal(report.count, 1);
  assert.equal(report.items[0]?.totalIn, 400000);
  assert.equal(report.items[0]?.totalOut, 150000);
  assert.equal(report.items[0]?.balance, 350000);
  assert.equal(report.totalBalance, 350000);
});

test("incomeVsExpense computes net and labels categories", async () => {
  const service = makeService({
    byDirection: [
      { direction: "IN", _sum: { amount: 900000 } },
      { direction: "OUT", _sum: { amount: 400000 } },
    ],
    byCategory: [
      { categoryId: "c1", direction: "IN", _sum: { amount: 900000 } },
      { categoryId: "c2", direction: "OUT", _sum: { amount: 400000 } },
    ],
    categories: [
      { id: "c1", name: "Iuran" },
      { id: "c2", name: "Listrik" },
    ],
  });

  const report = await service.incomeVsExpense(["b1"], {
    from: new Date("2026-01-01"),
    to: new Date("2026-12-31"),
  });

  assert.equal(report.income, 900000);
  assert.equal(report.expense, 400000);
  assert.equal(report.net, 500000);
  assert.deepEqual(
    report.items.map((item) => item.categoryName),
    ["Iuran", "Listrik"],
  );
});

test("incomeVsExpense rejects an inverted range", async () => {
  const service = makeService();

  await assert.rejects(
    () =>
      service.incomeVsExpense(["b1"], {
        from: new Date("2026-12-31"),
        to: new Date("2026-01-01"),
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("eventBudgetRealization reports usage against budget", async () => {
  const service = makeService({
    event: { id: "ev1", title: "Makrab", status: "DONE", buildingId: "b1", building: { id: "b1", name: "Gedung 1" }, budgetAmount: 1000000 },
    eventExpenses: { _sum: { amount: 1200000 }, _count: 4 },
  });

  const report = await service.eventBudgetRealization("ev1");

  assert.equal(report.realizedAmount, 1200000);
  assert.equal(report.remaining, -200000);
  assert.equal(report.usagePercent, 120);
  assert.equal(report.expenseCount, 4);
  assert.equal(report.overBudget, true);
});

test("eventBudgetRealization returns 404 when the event is missing", async () => {
  const service = makeService({ event: null });

  await assert.rejects(
    () => service.eventBudgetRealization("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});
