import { AppError } from "./errors.ts";

export type LedgerDirectionValue = "IN" | "OUT";

export type LedgerSourceValue =
  | "PAYMENT"
  | "EXPENSE"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "OPENING"
  | "REVERSAL";

export type LedgerMovement = {
  direction: LedgerDirectionValue;
  amount: number;
};

export const computeBalance = (
  openingBalance: number,
  entries: LedgerMovement[],
): number =>
  entries.reduce(
    (balance, entry) =>
      entry.direction === "IN" ? balance + entry.amount : balance - entry.amount,
    openingBalance,
  );

export type ReversibleEntry = {
  id: string;
  cashAccountId: string;
  direction: LedgerDirectionValue;
  amount: number;
  categoryId: string;
};

export type ReversalEntry = {
  cashAccountId: string;
  direction: LedgerDirectionValue;
  amount: number;
  categoryId: string;
  sourceType: "REVERSAL";
  sourceId: string;
  description: string;
};

export const buildReversal = (
  entry: ReversibleEntry,
  reason: string,
): ReversalEntry => {
  if (entry.amount <= 0) {
    throw new AppError("entry amount must be positive", 400);
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new AppError("reversal reason is required", 400);
  }
  return {
    cashAccountId: entry.cashAccountId,
    direction: entry.direction === "IN" ? "OUT" : "IN",
    amount: entry.amount,
    categoryId: entry.categoryId,
    sourceType: "REVERSAL",
    sourceId: entry.id,
    description: `Reversal: ${trimmed}`,
  };
};
