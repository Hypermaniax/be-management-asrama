import assert from "node:assert/strict";
import test from "node:test";
import { buildReversal, computeBalance } from "./ledger.ts";

test("computeBalance adds IN and subtracts OUT from opening balance", () => {
  const balance = computeBalance(1000, [
    { direction: "IN", amount: 500 },
    { direction: "OUT", amount: 200 },
    { direction: "IN", amount: 100 },
  ]);

  assert.equal(balance, 1400);
});

test("computeBalance with no entries returns opening balance", () => {
  assert.equal(computeBalance(2500, []), 2500);
});

test("buildReversal flips IN to OUT", () => {
  const reversal = buildReversal(
    { id: "e1", cashAccountId: "c1", direction: "IN", amount: 5000, categoryId: "cat1" },
    "salah input",
  );

  assert.equal(reversal.direction, "OUT");
  assert.equal(reversal.amount, 5000);
  assert.equal(reversal.sourceType, "REVERSAL");
  assert.equal(reversal.sourceId, "e1");
  assert.match(reversal.description, /salah input/);
});

test("buildReversal flips OUT to IN", () => {
  const reversal = buildReversal(
    { id: "e2", cashAccountId: "c1", direction: "OUT", amount: 3000, categoryId: "cat2" },
    "batal beli",
  );

  assert.equal(reversal.direction, "IN");
});

test("buildReversal requires a reason", () => {
  assert.throws(
    () =>
      buildReversal(
        { id: "e3", cashAccountId: "c1", direction: "IN", amount: 100, categoryId: "c" },
        "   ",
      ),
    (err: { status?: number }) => err.status === 400,
  );
});
