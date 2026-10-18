import { AppError } from "../../lib/errors.ts";
import { buildReversal } from "../../lib/ledger.ts";
import type { TransactionRunner } from "../../lib/prisma.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type {
  CashAccountRepository,
  CashAccountType,
} from "../../repositories/cashAccounts.ts";
import type {
  CategoryKind,
  CategoryRepository,
} from "../../repositories/categories.ts";
import type { ExpenseRepository } from "../../repositories/expenses.ts";
import type { LedgerRepository } from "../../repositories/ledger.ts";

type CashDeps = {
  cashAccounts: CashAccountRepository;
  categories: CategoryRepository;
  expenses: ExpenseRepository;
  ledger: LedgerRepository;
  buildings: BuildingRepository;
  transaction: TransactionRunner;
};

type CreateAccountInput = {
  buildingId: string;
  name: string;
  type?: CashAccountType;
  openingBalance?: number;
};

type UpdateAccountInput = {
  name?: string;
  type?: CashAccountType;
  openingBalance?: number;
};

type CreateCategoryInput = {
  buildingId: string;
  name: string;
  kind: CategoryKind;
};

type UpdateCategoryInput = {
  name?: string;
  kind?: CategoryKind;
};

type RecordExpenseInput = {
  categoryId: string;
  amount: number;
  occurredAt: Date;
  receiptFileId: string;
  cashAccountId?: string | null;
  vendor?: string | null;
  description?: string | null;
  eventId?: string | null;
  idempotencyKey: string;
  createdById?: string | null;
};

type RecordIncomeInput = {
  categoryId: string;
  amount: number;
  idempotencyKey: string;
  occurredAt?: Date;
  cashAccountId?: string | null;
  description?: string | null;
  createdById?: string | null;
};

export const createCashService = ({
  cashAccounts,
  categories,
  expenses,
  ledger,
  buildings,
  transaction,
}: CashDeps) => {
  const resolveAccount = async (buildingId: string, cashAccountId?: string | null) => {
    if (cashAccountId) {
      const account = await cashAccounts.findById(cashAccountId);
      if (!account) {
        throw new AppError("Cash account not found", 404);
      }
      if (account.buildingId !== buildingId) {
        throw new AppError("Cash account belongs to another building", 400);
      }
      return account;
    }
    const account = await cashAccounts.findByBuildingId(buildingId);
    if (!account) {
      throw new AppError("Building has no cash account", 409);
    }
    return account;
  };

  const getCategory = async (id: string, kind: CategoryKind) => {
    const category = await categories.findById(id);
    if (!category) {
      throw new AppError("Category not found", 404);
    }
    if (category.kind !== kind) {
      throw new AppError(`Category must be of kind ${kind}`, 400);
    }
    return category;
  };

  return {
    async createCashAccount({ buildingId, name, type, openingBalance }: CreateAccountInput) {
      if (!(await buildings.findById(buildingId))) {
        throw new AppError("Building not found", 404);
      }
      if (await cashAccounts.findByBuildingId(buildingId)) {
        throw new AppError("Building already has a cash account", 409);
      }
      return cashAccounts.create({ buildingId, name, type, openingBalance });
    },

    listCashAccounts(buildingIds?: string[]) {
      return cashAccounts.list(buildingIds);
    },

    async getCashAccount(id: string) {
      const account = await cashAccounts.findById(id);
      if (!account) {
        throw new AppError("Cash account not found", 404);
      }
      return account;
    },

    async getCategory(id: string) {
      const category = await categories.findById(id);
      if (!category) {
        throw new AppError("Category not found", 404);
      }
      return category;
    },

    async getLedgerEntry(id: string) {
      const entry = await ledger.findById(id);
      if (!entry) {
        throw new AppError("Ledger entry not found", 404);
      }
      return entry;
    },

    async getExpense(id: string) {
      const expense = await expenses.findById(id);
      if (!expense) {
        throw new AppError("Expense not found", 404);
      }
      return expense;
    },

    async updateCashAccount(id: string, data: UpdateAccountInput) {
      await this.getCashAccount(id);
      return cashAccounts.update(id, data);
    },

    async deleteCashAccount(id: string) {
      await this.getCashAccount(id);
      const entries = await ledger.listByAccount(id);
      if (entries.length > 0) {
        throw new AppError("Cannot delete a cash account that has ledger entries", 409);
      }
      return cashAccounts.softDelete(id);
    },

    async createCategory({ buildingId, name, kind }: CreateCategoryInput) {
      if (!(await buildings.findById(buildingId))) {
        throw new AppError("Building not found", 404);
      }
      if (await categories.findByName(buildingId, name)) {
        throw new AppError("Category name already exists for this building", 409);
      }
      return categories.create({ buildingId, name, kind });
    },

    listCategories(buildingIds?: string[], kind?: CategoryKind) {
      return categories.list(buildingIds, kind);
    },

    async updateCategory(id: string, data: UpdateCategoryInput) {
      const category = await categories.findById(id);
      if (!category) {
        throw new AppError("Category not found", 404);
      }
      if (data.name && data.name !== category.name) {
        const clash = await categories.findByName(category.buildingId, data.name);
        if (clash) {
          throw new AppError("Category name already exists for this building", 409);
        }
      }
      return categories.update(id, data);
    },

    async deleteCategory(id: string) {
      const category = await categories.findById(id);
      if (!category) {
        throw new AppError("Category not found", 404);
      }
      return categories.softDelete(id);
    },

    async recordExpense(input: RecordExpenseInput) {
      const { categoryId, amount, idempotencyKey } = input;
      if (amount <= 0) {
        throw new AppError("amount must be greater than 0", 400);
      }
      const category = await getCategory(categoryId, "EXPENSE");
      const account = await resolveAccount(category.buildingId, input.cashAccountId);

      const existing = await expenses.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }

      return transaction(async (tx) => {
        const expense = await expenses.create(
          {
            cashAccountId: account.id,
            categoryId,
            amount,
            occurredAt: input.occurredAt,
            vendor: input.vendor ?? null,
            description: input.description ?? null,
            receiptFileId: input.receiptFileId,
            eventId: input.eventId ?? null,
            createdById: input.createdById ?? "",
            idempotencyKey,
          },
          tx,
        );
        await ledger.create(
          {
            cashAccountId: account.id,
            direction: "OUT",
            amount,
            categoryId,
            sourceType: "EXPENSE",
            sourceId: expense.id,
            idempotencyKey: `expense:${idempotencyKey}`,
            occurredAt: input.occurredAt,
            description: input.description ?? input.vendor ?? "Pengeluaran",
            createdById: input.createdById ?? null,
          },
          tx,
        );
        return expense;
      });
    },

    async recordManualIncome(input: RecordIncomeInput) {
      const { categoryId, amount, idempotencyKey } = input;
      if (amount <= 0) {
        throw new AppError("amount must be greater than 0", 400);
      }
      const category = await getCategory(categoryId, "INCOME");
      const account = await resolveAccount(category.buildingId, input.cashAccountId);

      const existing = await ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }

      return ledger.create({
        cashAccountId: account.id,
        direction: "IN",
        amount,
        categoryId,
        sourceType: "ADJUSTMENT",
        idempotencyKey,
        occurredAt: input.occurredAt ?? new Date(),
        description: input.description ?? "Pemasukan manual",
        createdById: input.createdById ?? null,
      });
    },

    async reverseLedgerEntry(entryId: string, reason: string, createdById?: string | null) {
      const entry = await ledger.findById(entryId);
      if (!entry) {
        throw new AppError("Ledger entry not found", 404);
      }
      if (entry.sourceType === "REVERSAL") {
        throw new AppError("Cannot reverse a reversal entry", 409);
      }
      if (await ledger.findBySource("REVERSAL", entryId)) {
        throw new AppError("Ledger entry has already been reversed", 409);
      }
      const reversal = buildReversal(
        {
          id: entry.id,
          cashAccountId: entry.cashAccountId,
          direction: entry.direction,
          amount: entry.amount,
          categoryId: entry.categoryId,
        },
        reason,
      );
      return ledger.create({
        ...reversal,
        idempotencyKey: `reversal:${entry.id}`,
        occurredAt: new Date(),
        createdById: createdById ?? null,
      });
    },

    async getBalance(cashAccountId: string) {
      const account = await this.getCashAccount(cashAccountId);
      const { totalIn, totalOut } = await ledger.sumByAccount(cashAccountId);
      return {
        cashAccountId,
        openingBalance: account.openingBalance,
        totalIn,
        totalOut,
        balance: account.openingBalance + totalIn - totalOut,
      };
    },

    listExpenses(buildingIds?: string[], filters: { cashAccountId?: string } = {}) {
      return expenses.list(buildingIds, filters);
    },

    getLedger(buildingIds?: string[], filters: { cashAccountId?: string } = {}) {
      if (filters.cashAccountId) {
        return ledger.listByAccount(filters.cashAccountId);
      }
      return ledger.list(buildingIds, filters);
    },
  };
};

export type CashService = ReturnType<typeof createCashService>;
