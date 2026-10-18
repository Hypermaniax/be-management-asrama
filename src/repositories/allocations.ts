import type { PaymentAllocation } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { PaymentAllocation };

export const allocationRepository = {
  listByPayment(paymentId: string) {
    return prisma.paymentAllocation.findMany({ where: { paymentId } });
  },

  listByInvoice(invoiceId: string) {
    return prisma.paymentAllocation.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
    });
  },

  async sumByInvoice(invoiceId: string) {
    const result = await prisma.paymentAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },
};

export type AllocationRepository = typeof allocationRepository;
