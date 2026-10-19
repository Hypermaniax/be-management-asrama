import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { CategoryRepository } from "../../repositories/categories.ts";
import type { ReportRepository } from "../../repositories/reports.ts";

type ReportDeps = {
  reports: ReportRepository;
  categories: CategoryRepository;
  buildings: BuildingRepository;
};

type ArrearFilters = { year?: number; month?: number };
type RangeFilters = { from?: Date; to?: Date };

export const createReportService = ({ reports, categories, buildings }: ReportDeps) => {
  const assertBuilding = async (buildingId?: string) => {
    if (buildingId && !(await buildings.findById(buildingId))) {
      throw new AppError("Building not found", 404);
    }
  };

  return {
    async arrears(buildingIds?: string[], filters: ArrearFilters = {}) {
      await assertBuilding(buildingIds?.[0]);
      const invoices = await reports.listArrears(buildingIds, filters);
      const items = invoices.map((invoice) => ({
        invoiceId: invoice.id,
        code: invoice.code,
        userId: invoice.userId,
        userName: invoice.user.name,
        buildingId: invoice.buildingId,
        buildingName: invoice.building.name,
        periodYear: invoice.periodYear,
        periodMonth: invoice.periodMonth,
        dueDate: invoice.dueDate,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        outstanding: invoice.totalAmount - invoice.paidAmount,
        status: invoice.status,
      }));
      return {
        year: filters.year ?? null,
        month: filters.month ?? null,
        count: items.length,
        totalOutstanding: items.reduce((sum, item) => sum + item.outstanding, 0),
        items,
      };
    },

    async cashBalances(buildingIds?: string[]) {
      await assertBuilding(buildingIds?.[0]);
      const [accounts, sums] = await Promise.all([
        reports.listCashAccounts(buildingIds),
        reports.sumLedgerByAccount(),
      ]);
      const items = accounts.map((account) => {
        const rows = sums.filter((row) => row.cashAccountId === account.id);
        const totalIn = rows.find((row) => row.direction === "IN")?._sum.amount ?? 0;
        const totalOut = rows.find((row) => row.direction === "OUT")?._sum.amount ?? 0;
        return {
          cashAccountId: account.id,
          name: account.name,
          type: account.type,
          buildingId: account.buildingId,
          buildingName: account.building.name,
          openingBalance: account.openingBalance,
          totalIn,
          totalOut,
          balance: account.openingBalance + totalIn - totalOut,
        };
      });
      return {
        count: items.length,
        totalBalance: items.reduce((sum, item) => sum + item.balance, 0),
        items,
      };
    },

    async incomeVsExpense(buildingIds?: string[], range: RangeFilters = {}) {
      await assertBuilding(buildingIds?.[0]);
      if (range.from && range.to && range.to < range.from) {
        throw new AppError("to must be on or after from", 400);
      }
      const [byDirection, byCategory, categoryList] = await Promise.all([
        reports.sumLedgerByDirection(buildingIds, range),
        reports.sumLedgerByCategory(buildingIds, range),
        categories.list(buildingIds),
      ]);
      const income = byDirection.find((row) => row.direction === "IN")?._sum.amount ?? 0;
      const expense = byDirection.find((row) => row.direction === "OUT")?._sum.amount ?? 0;
      const categoryNames = new Map(categoryList.map((category) => [category.id, category.name]));
      const items = byCategory.map((row) => ({
        categoryId: row.categoryId,
        categoryName: categoryNames.get(row.categoryId) ?? null,
        direction: row.direction,
        total: row._sum.amount ?? 0,
      }));
      return {
        from: range.from ?? null,
        to: range.to ?? null,
        income,
        expense,
        net: income - expense,
        items,
      };
    },

    async eventBudgetRealization(eventId: string) {
      const event = await reports.findEvent(eventId);
      if (!event) {
        throw new AppError("Event not found", 404);
      }
      const aggregate = await reports.sumEventExpenses(eventId);
      const realizedAmount = aggregate._sum.amount ?? 0;
      const budgetAmount = event.budgetAmount;
      return {
        eventId: event.id,
        title: event.title,
        status: event.status,
        buildingId: event.buildingId,
        buildingName: event.building?.name ?? null,
        budgetAmount,
        realizedAmount,
        remaining: budgetAmount === null ? null : budgetAmount - realizedAmount,
        usagePercent:
          budgetAmount && budgetAmount > 0
            ? Math.round((realizedAmount / budgetAmount) * 100)
            : null,
        expenseCount: aggregate._count,
        overBudget: budgetAmount !== null && budgetAmount > 0 && realizedAmount > budgetAmount,
      };
    },
  };
};

export type ReportService = ReturnType<typeof createReportService>;
