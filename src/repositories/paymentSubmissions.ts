import type {
  PaymentMethod,
  PaymentSubmission,
  PaymentSubmissionStatus,
} from "../generated/prisma/client.ts";
import type { Db } from "../lib/prisma.ts";
import { prisma } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export type { PaymentSubmission, PaymentSubmissionStatus };

export type CreatePaymentSubmissionInput = {
  code: string;
  userId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNo?: string | null;
  proofFileId?: string | null;
  note?: string | null;
};

export type PaymentSubmissionFilters = {
  status?: PaymentSubmissionStatus;
  userId?: string;
};

const invoiceInclude = {
  invoice: {
    select: {
      id: true,
      code: true,
      buildingId: true,
      userId: true,
      periodYear: true,
      periodMonth: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
    },
  },
};

export const paymentSubmissionRepository = {
  create(data: CreatePaymentSubmissionInput) {
    return prisma.paymentSubmission.create({
      data,
      include: { ...invoiceInclude, proofFile: true },
    });
  },

  findById(id: string) {
    return prisma.paymentSubmission.findFirst({
      where: { id, deletedAt: null },
      include: { ...invoiceInclude, proofFile: true, payment: true },
    });
  },

  findPendingByInvoice(invoiceId: string) {
    return prisma.paymentSubmission.findFirst({
      where: { invoiceId, status: "PENDING", deletedAt: null },
    });
  },

  list(buildingIds?: string[], filters: PaymentSubmissionFilters = {}) {
    return prisma.paymentSubmission.findMany({
      where: {
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(buildingIds ? { invoice: { buildingId: { in: buildingIds } } } : {}),
      },
      include: { ...invoiceInclude, user: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" },
    });
  },

  listByUser(userId: string, filters: PaymentSubmissionFilters = {}) {
    return prisma.paymentSubmission.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  claimPending(id: string, reviewerId: string, reviewedAt: Date, client: Db = prisma) {
    return client.paymentSubmission.updateMany({
      where: { id, status: "PENDING", deletedAt: null },
      data: {
        status: "VERIFIED",
        reviewedById: reviewerId,
        reviewedAt,
        reviewNote: null,
      },
    });
  },

  attachPayment(id: string, paymentId: string, client: Db = prisma) {
    return client.paymentSubmission.update({
      where: { id },
      data: { paymentId },
    });
  },

  reject(id: string, reviewerId: string, reason: string, client: Db = prisma) {
    return client.paymentSubmission.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });
  },
};

export type PaymentSubmissionRepository = typeof paymentSubmissionRepository;
