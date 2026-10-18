import assert from "node:assert/strict";
import { test } from "node:test";
import { allocate, computeInvoice, deriveStatus } from "./billing.ts";

test("computeInvoice subtracts the discount from the base", () => {
  assert.deepEqual(computeInvoice({ base: 350000, discount: 50000 }), {
    baseAmount: 350000,
    discountAmount: 50000,
    totalAmount: 300000,
  });
});

test("computeInvoice defaults discount to zero", () => {
  assert.equal(computeInvoice({ base: 350000 }).totalAmount, 350000);
});

test("computeInvoice rejects a discount larger than the base", () => {
  assert.throws(
    () => computeInvoice({ base: 1000, discount: 2000 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("deriveStatus returns PAID when fully paid", () => {
  assert.equal(deriveStatus(300000, 300000, new Date("2026-01-10")), "PAID");
});

test("deriveStatus returns PARTIAL when partly paid before due", () => {
  assert.equal(
    deriveStatus(300000, 100000, new Date("2026-01-10"), new Date("2026-01-05")),
    "PARTIAL",
  );
});

test("deriveStatus returns ISSUED when unpaid before due", () => {
  assert.equal(
    deriveStatus(300000, 0, new Date("2026-01-10"), new Date("2026-01-05")),
    "ISSUED",
  );
});

test("deriveStatus returns OVERDUE when unpaid past due", () => {
  assert.equal(
    deriveStatus(300000, 0, new Date("2026-01-10"), new Date("2026-02-01")),
    "OVERDUE",
  );
});

test("allocate fills the oldest invoice first and spills over", () => {
  const { allocations, unallocated } = allocate(500000, [
    { id: "i1", totalAmount: 300000, paidAmount: 0 },
    { id: "i2", totalAmount: 300000, paidAmount: 0 },
  ]);

  assert.deepEqual(allocations, [
    { invoiceId: "i1", amount: 300000 },
    { invoiceId: "i2", amount: 200000 },
  ]);
  assert.equal(unallocated, 0);
});

test("allocate skips settled invoices and reports leftover", () => {
  const { allocations, unallocated } = allocate(400000, [
    { id: "i1", totalAmount: 300000, paidAmount: 300000 },
    { id: "i2", totalAmount: 300000, paidAmount: 100000 },
  ]);

  assert.deepEqual(allocations, [{ invoiceId: "i2", amount: 200000 }]);
  assert.equal(unallocated, 200000);
});

test("allocate rejects a negative amount", () => {
  assert.throws(
    () => allocate(-1, []),
    (err: { status?: number }) => err.status === 400,
  );
});
