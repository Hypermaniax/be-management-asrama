import { randomUUID } from "node:crypto";
import { allocate, computeInvoice, deriveStatus } from "../../lib/billing.ts";
import { AppError } from "../../lib/errors.ts";
import { detectMime } from "../../lib/fileType.ts";
import type { TransactionRunner } from "../../lib/prisma.ts";
import type { Storage } from "../../lib/storage.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { CashAccountRepository } from "../../repositories/cashAccounts.ts";
import type { CategoryRepository } from "../../repositories/categories.ts";
import type { FeeRuleRepository } from "../../repositories/feeRules.ts";
import type { FileRepository } from "../../repositories/files.ts";
import type { InvoiceFilters, InvoiceRepository } from "../../repositories/invoices.ts";
import type { LedgerRepository } from "../../repositories/ledger.ts";
import type { OccupancyRepository } from "../../repositories/occupancies.ts";
import type { PaymentSubmissionRepository } from "../../repositories/paymentSubmissions.ts";
import type {
  CreatePaymentInput,
  PaymentFilters,
  PaymentRepository,
} from "../../repositories/payments.ts";
import type { UserRepository } from "../../repositories/users.ts";

const PROOF_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

type BillingDeps = {
  invoices: InvoiceRepository;
  payments: PaymentRepository;
  paymentSubmissions: PaymentSubmissionRepository;
  occupancies: OccupancyRepository;
  feeRules: FeeRuleRepository;
  buildings: BuildingRepository;
  users: UserRepository;
  cashAccounts: CashAccountRepository;
  categories: CategoryRepository;
  ledger: LedgerRepository;
  files: FileRepository;
  storage: Storage;
  transaction: TransactionRunner;
};

type GenerateInput = {
  buildingId: string;
  year: number;
  month: number;
  createdById?: string | null;
};

type RecordPaymentInput = Omit<CreatePaymentInput, "code"> & {
  allocations?: { invoiceId: string; amount: number }[];
};

type CreateSubmissionInput = {
  invoiceId: string;
  amount: number;
  method: "TRANSFER" | "QRIS";
  proofFileId: string;
  referenceNo?: string | null;
  note?: string | null;
};

type UploadProofInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type PostPaymentInput = {
  userId: string;
  amount: number;
  method: CreatePaymentInput["method"];
  cashAccountId?: string | null;
  referenceNo?: string | null;
  proofFileId?: string | null;
  idempotencyKey: string;
  receivedById?: string | null;
  note?: string | null;
  buildingId: string;
  allocations: { invoiceId: string; amount: number }[];
  invoiceUpdates: { id: string; paidAmount: number; status: "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID" }[];
};

const makeCode = (prefix: string) =>
  `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

export const createBillingService = ({
  invoices,
  payments,
  paymentSubmissions,
  occupancies,
  feeRules,
  buildings,
  users,
  cashAccounts,
  categories,
  ledger,
  files,
  storage,
  transaction,
}: BillingDeps) => {
  const resolvePosting = async (buildingId: string, cashAccountId?: string | null) => {
    const account = cashAccountId
      ? await cashAccounts.findById(cashAccountId)
      : await cashAccounts.findByBuildingId(buildingId);
    if (!account) {
      throw new AppError("Building has no cash account", 409);
    }
    if (account.buildingId !== buildingId) {
      throw new AppError("Cash account belongs to another building", 400);
    }

    let category = await categories.findByName(buildingId, "Iuran");
    if (!category || category.kind !== "INCOME") {
      category = (await categories.list([buildingId], "INCOME"))[0];
    }
    if (!category) {
      throw new AppError("No income category for this building", 409);
    }
    return { account, category };
  };

  const postPayment = async (input: PostPaymentInput) => {
    const { account, category } = await resolvePosting(
      input.buildingId,
      input.cashAccountId,
    );

    return transaction(async (tx) => {
      const payment = await payments.record(
        {
          code: makeCode("PAY"),
          userId: input.userId,
          amount: input.amount,
          method: input.method,
          cashAccountId: account.id,
          referenceNo: input.referenceNo ?? null,
          proofFileId: input.proofFileId ?? null,
          idempotencyKey: input.idempotencyKey,
          receivedById: input.receivedById ?? null,
          note: input.note ?? null,
        },
        input.allocations,
        input.invoiceUpdates,
        tx,
      );
      await ledger.create(
        {
          cashAccountId: account.id,
          direction: "IN",
          amount: input.amount,
          categoryId: category.id,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          idempotencyKey: `payment:${payment.id}`,
          occurredAt: payment.paidAt ?? new Date(),
          description: `Pembayaran ${payment.code}`,
          createdById: input.receivedById ?? null,
        },
        tx,
      );
      return payment;
    });
  };

  return {
  async generateMonthly({ buildingId, year, month, createdById }: GenerateInput) {
    if (month < 1 || month > 12) {
      throw new AppError("month must be between 1 and 12", 400);
    }
    if (!(await buildings.findById(buildingId))) {
      throw new AppError("Building not found", 404);
    }

    const now = new Date();
    const feeRule = await feeRules.findActiveForBuilding(buildingId, now);
    if (!feeRule) {
      throw new AppError("No active fee rule for this building", 409);
    }

    const dueDate = new Date(Date.UTC(year, month - 1, feeRule.dueDayOfMonth));
    const active = await occupancies.listActiveByBuilding(buildingId);

    const created = [];
    for (const occupancy of active) {
      if (await invoices.findActiveByUserPeriod(occupancy.userId, year, month)) {
        continue;
      }
      const amounts = computeInvoice({ base: occupancy.monthlyRateSnapshot });
      const invoice = await invoices.create({
        code: makeCode("INV"),
        buildingId,
        userId: occupancy.userId,
        occupancyId: occupancy.id,
        periodYear: year,
        periodMonth: month,
        dueDate,
        ...amounts,
        createdById: createdById ?? null,
        lines: [
          {
            kind: "RENT",
            description: `Sewa kamar ${month}/${year}`,
            amount: amounts.baseAmount,
          },
        ],
      });
      created.push(invoice);
    }

    return created;
  },

  listInvoices(buildingIds?: string[], filters?: InvoiceFilters) {
    return invoices.list(buildingIds, filters);
  },

  async getInvoice(id: string) {
    const invoice = await invoices.findById(id);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }
    return invoice;
  },

  async voidInvoice(id: string) {
    const invoice = await invoices.findById(id);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }
    if (invoice.status === "VOID") {
      throw new AppError("Invoice is already void", 409);
    }
    if (invoice.paidAmount > 0) {
      throw new AppError("Cannot void an invoice that has payments", 409);
    }
    return invoices.void(id);
  },

  async recordPayment(input: RecordPaymentInput) {
    const {
      userId,
      amount,
      method,
      cashAccountId,
      referenceNo,
      proofFileId,
      idempotencyKey,
      receivedById,
      note,
      allocations: requested,
    } = input;

    if (amount <= 0) {
      throw new AppError("amount must be greater than 0", 400);
    }
    const user = await users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const existing = await payments.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    const outstanding = await invoices.listOutstandingByUser(userId);
    const byId = new Map(outstanding.map((invoice) => [invoice.id, invoice]));

    let planned: { invoiceId: string; amount: number }[];
    if (requested && requested.length > 0) {
      let sum = 0;
      for (const item of requested) {
        const invoice = byId.get(item.invoiceId);
        if (!invoice) {
          throw new AppError("Invoice is not outstanding for this user", 400);
        }
        if (item.amount <= 0) {
          throw new AppError("Allocation amount must be greater than 0", 400);
        }
        if (item.amount > invoice.totalAmount - invoice.paidAmount) {
          throw new AppError("Allocation exceeds the invoice remaining amount", 400);
        }
        sum += item.amount;
      }
      if (sum > amount) {
        throw new AppError("Allocations exceed the payment amount", 400);
      }
      planned = requested;
    } else {
      planned = allocate(
        amount,
        outstanding.map((invoice) => ({
          id: invoice.id,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
        })),
      ).allocations;
    }

    const invoiceUpdates = planned.map((item) => {
      const invoice = byId.get(item.invoiceId)!;
      const paidAmount = invoice.paidAmount + item.amount;
      return {
        id: invoice.id,
        paidAmount,
        status: deriveStatus(invoice.totalAmount, paidAmount, invoice.dueDate),
      };
    });

    const firstInvoice = planned.length > 0 ? byId.get(planned[0].invoiceId) : undefined;
    const buildingId = firstInvoice?.buildingId ?? user.buildingId;
    if (!buildingId) {
      throw new AppError("User is not assigned to a building", 409);
    }

    return postPayment({
      userId,
      amount,
      method,
      cashAccountId,
      referenceNo,
      proofFileId,
      idempotencyKey,
      receivedById,
      note,
      buildingId,
      allocations: planned,
      invoiceUpdates,
    });
  },

  listMyInvoices(
    userId: string,
    filters: {
      status?: "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID";
      year?: number;
      month?: number;
    } = {},
  ) {
    return invoices.listByUser(userId, filters);
  },

  async getMyInvoice(userId: string, id: string) {
    const invoice = await invoices.findById(id);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }
    if (invoice.userId !== userId) {
      throw new AppError("Forbidden", 403);
    }
    return invoice;
  },

  async uploadProof(userId: string, file: UploadProofInput) {
    if (!PROOF_MIME_TYPES.includes(file.mimeType)) {
      throw new AppError("MIME type is not allowed", 400);
    }
    if (file.sizeBytes > MAX_PROOF_BYTES) {
      throw new AppError("File exceeds the maximum size", 400);
    }
    const detected = detectMime(file.buffer);
    if (!detected || !PROOF_MIME_TYPES.includes(detected)) {
      throw new AppError("File content does not match an allowed type", 400);
    }

    const stored = await storage.put(file.buffer, file.originalName);
    return files.create({
      storageKey: stored.storageKey,
      originalName: file.originalName,
      mimeType: detected,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      uploadedById: userId,
    });
  },

  async createSubmission(userId: string, input: CreateSubmissionInput) {
    const invoice = await invoices.findById(input.invoiceId);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }
    if (invoice.userId !== userId) {
      throw new AppError("Forbidden", 403);
    }
    if (!["ISSUED", "PARTIAL", "OVERDUE"].includes(invoice.status)) {
      throw new AppError("Invoice is not outstanding", 409);
    }

    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (remaining <= 0) {
      throw new AppError("Invoice is already paid", 409);
    }
    if (input.amount !== remaining) {
      throw new AppError("amount must equal the invoice remaining amount", 400);
    }

    const proof = await files.findById(input.proofFileId);
    if (!proof) {
      throw new AppError("Proof file not found", 404);
    }
    if (proof.uploadedById !== userId) {
      throw new AppError("Proof file does not belong to this user", 403);
    }

    if (await paymentSubmissions.findPendingByInvoice(invoice.id)) {
      throw new AppError("This invoice already has a pending submission", 409);
    }

    try {
      return await paymentSubmissions.create({
        code: makeCode("SUB"),
        userId,
        invoiceId: invoice.id,
        amount: input.amount,
        method: input.method,
        referenceNo: input.referenceNo ?? null,
        proofFileId: proof.id,
        note: input.note ?? null,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new AppError("This invoice already has a pending submission", 409);
      }
      throw error;
    }
  },

  listMySubmissions(userId: string, filters?: { status?: "PENDING" | "VERIFIED" | "REJECTED" }) {
    return paymentSubmissions.listByUser(userId, filters);
  },

  async getMySubmission(userId: string, id: string) {
    const submission = await paymentSubmissions.findById(id);
    if (!submission) {
      throw new AppError("Payment submission not found", 404);
    }
    if (submission.userId !== userId) {
      throw new AppError("Forbidden", 403);
    }
    return submission;
  },

  async getSubmission(id: string) {
    const submission = await paymentSubmissions.findById(id);
    if (!submission) {
      throw new AppError("Payment submission not found", 404);
    }
    return submission;
  },

  listSubmissions(
    buildingIds?: string[],
    filters?: { status?: "PENDING" | "VERIFIED" | "REJECTED"; userId?: string },
  ) {
    return paymentSubmissions.list(buildingIds, filters);
  },

  async verifySubmission(
    id: string,
    reviewerId: string,
    input: { cashAccountId?: string | null } = {},
  ) {
    const submission = await paymentSubmissions.findById(id);
    if (!submission) {
      throw new AppError("Payment submission not found", 404);
    }
    if (submission.status === "VERIFIED") {
      const payment =
        submission.payment ??
        (submission.paymentId ? await payments.findById(submission.paymentId) : null);
      return { submission, payment };
    }
    if (submission.status !== "PENDING") {
      throw new AppError("Only PENDING submissions can be verified", 409);
    }
    if (!submission.proofFileId) {
      throw new AppError("Payment proof is required", 400);
    }

    const invoice = await invoices.findById(submission.invoiceId);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }
    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (remaining <= 0) {
      throw new AppError("Invoice is already paid", 409);
    }
    if (submission.amount !== remaining) {
      throw new AppError(
        "Submission amount does not match the invoice remaining amount",
        409,
      );
    }

    const { account, category } = await resolvePosting(
      invoice.buildingId,
      input.cashAccountId,
    );

    const payment = await transaction(async (tx) => {
      const claimed = await paymentSubmissions.claimPending(
        submission.id,
        reviewerId,
        new Date(),
        tx,
      );
      if (claimed.count === 0) {
        throw new AppError("Submission is no longer pending", 409);
      }

      const created = await payments.record(
        {
          code: makeCode("PAY"),
          userId: submission.userId,
          amount: submission.amount,
          method: submission.method,
          cashAccountId: account.id,
          referenceNo: submission.referenceNo,
          proofFileId: submission.proofFileId,
          idempotencyKey: `submission:${submission.id}`,
          receivedById: reviewerId,
          note: submission.note,
        },
        [{ invoiceId: invoice.id, amount: submission.amount }],
        [
          {
            id: invoice.id,
            paidAmount: invoice.paidAmount + submission.amount,
            status: deriveStatus(
              invoice.totalAmount,
              invoice.paidAmount + submission.amount,
              invoice.dueDate,
            ),
          },
        ],
        tx,
      );

      await ledger.create(
        {
          cashAccountId: account.id,
          direction: "IN",
          amount: submission.amount,
          categoryId: category.id,
          sourceType: "PAYMENT",
          sourceId: created.id,
          idempotencyKey: `payment:${created.id}`,
          occurredAt: created.paidAt ?? new Date(),
          description: `Pembayaran ${created.code}`,
          createdById: reviewerId,
        },
        tx,
      );

      await paymentSubmissions.attachPayment(submission.id, created.id, tx);
      return created;
    });

    const updated = await paymentSubmissions.findById(submission.id);
    return { submission: updated ?? submission, payment };
  },

  async rejectSubmission(id: string, reviewerId: string, reason: string) {
    const submission = await paymentSubmissions.findById(id);
    if (!submission) {
      throw new AppError("Payment submission not found", 404);
    }
    if (submission.status !== "PENDING") {
      throw new AppError("Only PENDING submissions can be rejected", 409);
    }
    return paymentSubmissions.reject(id, reviewerId, reason);
  },

  listPayments(buildingIds?: string[], filters?: PaymentFilters) {
    return payments.list(buildingIds, filters);
  },

  async getPayment(id: string) {
    const payment = await payments.findById(id);
    if (!payment) {
      throw new AppError("Payment not found", 404);
    }
    return payment;
  },
  };
};

export type BillingService = ReturnType<typeof createBillingService>;
