import type { Invoice, InvoiceLineKind, InvoiceStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Invoice, InvoiceStatus };

export type CreateInvoiceInput = {
  code: string;
  buildingId: string;
  userId: string;
  occupancyId: string;
  periodYear: number;
  periodMonth: number;
  dueDate: Date;
  baseAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdById?: string | null;
  lines: { kind: InvoiceLineKind; description: string; amount: number }[];
};

export type InvoiceFilters = {
  status?: InvoiceStatus;
  year?: number;
  month?: number;
};

export const invoiceRepository = {
  create(data: CreateInvoiceInput) {
    const { lines, ...invoice } = data;
    return prisma.invoice.create({
      data: { ...invoice, lines: { create: lines } },
      include: { lines: true },
    });
  },

  findById(id: string) {
    return prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { lines: true, allocations: true },
    });
  },

  findActiveByUserPeriod(userId: string, periodYear: number, periodMonth: number) {
    return prisma.invoice.findFirst({
      where: { userId, periodYear, periodMonth, deletedAt: null },
    });
  },

  listOutstandingByUser(userId: string) {
    return prisma.invoice.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
      },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    });
  },

  list(buildingIds?: string[], filters: InvoiceFilters = {}) {
    return prisma.invoice.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.year ? { periodYear: filters.year } : {}),
        ...(filters.month ? { periodMonth: filters.month } : {}),
      },
      include: { lines: true },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
  },

  updatePaymentState(id: string, data: { paidAmount: number; status: InvoiceStatus }) {
    return prisma.invoice.update({ where: { id }, data });
  },

  void(id: string) {
    return prisma.invoice.update({ where: { id }, data: { status: "VOID" } });
  },
};

export type InvoiceRepository = typeof invoiceRepository;
