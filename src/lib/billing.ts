import { AppError } from "./errors.ts";

export type InvoiceStatusValue = "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID";

export type InvoiceAmounts = {
  baseAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export const computeInvoice = ({
  base,
  discount = 0,
}: {
  base: number;
  discount?: number;
}): InvoiceAmounts => {
  if (base < 0) {
    throw new AppError("base must not be negative", 400);
  }
  if (discount < 0) {
    throw new AppError("discount must not be negative", 400);
  }
  if (discount > base) {
    throw new AppError("discount must not exceed base", 400);
  }
  return { baseAmount: base, discountAmount: discount, totalAmount: base - discount };
};

export const deriveStatus = (
  total: number,
  paid: number,
  dueDate: Date,
  now: Date = new Date(),
): InvoiceStatusValue => {
  if (paid >= total) {
    return "PAID";
  }
  if (dueDate.getTime() < now.getTime()) {
    return "OVERDUE";
  }
  if (paid > 0) {
    return "PARTIAL";
  }
  return "ISSUED";
};

export type OutstandingInvoice = {
  id: string;
  totalAmount: number;
  paidAmount: number;
};

export type Allocation = { invoiceId: string; amount: number };

export const allocate = (
  paymentAmount: number,
  invoices: OutstandingInvoice[],
): { allocations: Allocation[]; unallocated: number } => {
  if (paymentAmount < 0) {
    throw new AppError("amount must not be negative", 400);
  }
  let left = paymentAmount;
  const allocations: Allocation[] = [];
  for (const invoice of invoices) {
    if (left <= 0) {
      break;
    }
    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (remaining <= 0) {
      continue;
    }
    const amount = Math.min(remaining, left);
    allocations.push({ invoiceId: invoice.id, amount });
    left -= amount;
  }
  return { allocations, unallocated: left };
};
