import { randomUUID } from "node:crypto";
import { allocate, computeInvoice, deriveStatus } from "../../lib/billing.ts";
import { AppError } from "../../lib/errors.ts";
import type { TransactionRunner } from "../../lib/prisma.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { CashAccountRepository } from "../../repositories/cashAccounts.ts";
import type { CategoryRepository } from "../../repositories/categories.ts";
import type { FeeRuleRepository } from "../../repositories/feeRules.ts";
import type { InvoiceFilters, InvoiceRepository } from "../../repositories/invoices.ts";
import type { LedgerRepository } from "../../repositories/ledger.ts";
import type { OccupancyRepository } from "../../repositories/occupancies.ts";
import type {
  CreatePaymentInput,
  PaymentFilters,
  PaymentRepository,
} from "../../repositories/payments.ts";
import type { UserRepository } from "../../repositories/users.ts";

type BillingDeps = {
  invoices: InvoiceRepository;
  payments: PaymentRepository;
  occupancies: OccupancyRepository;
  feeRules: FeeRuleRepository;
  buildings: BuildingRepository;
  users: UserRepository;
  cashAccounts: CashAccountRepository;
  categories: CategoryRepository;
  ledger: LedgerRepository;
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

const makeCode = (prefix: string) =>
  `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

export const createBillingService = ({
  invoices,
  payments,
  occupancies,
  feeRules,
  buildings,
  users,
  cashAccounts,
  categories,
  ledger,
  transaction,
}: BillingDeps) => ({
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

    return transaction(async (tx) => {
      const payment = await payments.record(
        {
          code: makeCode("PAY"),
          userId,
          amount,
          method,
          cashAccountId: account.id,
          referenceNo: referenceNo ?? null,
          proofFileId: proofFileId ?? null,
          idempotencyKey,
          receivedById: receivedById ?? null,
          note: note ?? null,
        },
        planned,
        invoiceUpdates,
        tx,
      );
      await ledger.create(
        {
          cashAccountId: account.id,
          direction: "IN",
          amount,
          categoryId: category.id,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          idempotencyKey: `payment:${payment.id}`,
          occurredAt: payment.paidAt ?? new Date(),
          description: `Pembayaran ${payment.code}`,
          createdById: receivedById ?? null,
        },
        tx,
      );
      return payment;
    });
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
});

export type BillingService = ReturnType<typeof createBillingService>;
