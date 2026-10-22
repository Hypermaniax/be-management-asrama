import type { InvoiceStatus, Payment, PaymentMethod } from "../generated/prisma/client.ts";
import type { Db } from "../lib/prisma.ts";
import { prisma } from "../lib/prisma.ts";

export type { Payment, PaymentMethod };

export type CreatePaymentInput = {
  code: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  cashAccountId?: string | null;
  referenceNo?: string | null;
  proofFileId?: string | null;
  idempotencyKey: string;
  receivedById?: string | null;
  note?: string | null;
};

export type PaymentFilters = {
  userId?: string;
};

export const paymentRepository = {
  async record(
    data: CreatePaymentInput,
    allocations: { invoiceId: string; amount: number }[],
    invoiceUpdates: { id: string; paidAmount: number; status: InvoiceStatus }[],
    client: Db = prisma,
  ) {
    const payment = await client.payment.create({
      data: {
        ...data,
        ...(allocations.length > 0 ? { allocations: { create: allocations } } : {}),
      },
      include: { allocations: true },
    });
    for (const update of invoiceUpdates) {
      await client.invoice.update({
        where: { id: update.id },
        data: { paidAmount: update.paidAmount, status: update.status },
      });
    }
    return payment;
  },

  findById(id: string) {
    return prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: {
        allocations: true,
        user: { select: { id: true, buildingId: true } },
      },
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.payment.findFirst({
      where: { idempotencyKey, deletedAt: null },
      include: { allocations: true },
    });
  },

  list(buildingIds?: string[], filters: PaymentFilters = {}) {
    return prisma.payment.findMany({
      where: {
        deletedAt: null,
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(buildingIds ? { user: { buildingId: { in: buildingIds } } } : {}),
      },
      include: { allocations: true },
      orderBy: { paidAt: "desc" },
    });
  },
};

export type PaymentRepository = typeof paymentRepository;
