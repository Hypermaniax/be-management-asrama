import type { Request, Response } from "express";
import { reportService } from "../container.ts";
import { toCsv } from "../lib/csv.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import {
  arrearsQuerySchema,
  cashBalanceQuerySchema,
  incomeVsExpenseQuerySchema,
} from "../validations/report.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

const scopeBuildingIds = (req: Request): string[] | undefined => {
  const { scope } = req as ScopedRequest;
  if (scope && "buildingIds" in scope) {
    return scope.buildingIds;
  }
  return undefined;
};

const effectiveBuildingIds = (req: Request, buildingId?: string): string[] | undefined => {
  if (buildingId) {
    assertBuildingAccess(req, buildingId);
    return [buildingId];
  }
  return scopeBuildingIds(req);
};

const sendCsv = (res: Response, filename: string, csv: string) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
};

export const reportController = {
  async arrears(req: Request, res: Response) {
    const query = arrearsQuerySchema.parse(req.query);
    const buildingIds = effectiveBuildingIds(req, query.buildingId);
    const data = await reportService.arrears(buildingIds, {
      year: query.year,
      month: query.month,
    });
    res.json({ status: "ok", data });
  },

  async arrearsExport(req: Request, res: Response) {
    const query = arrearsQuerySchema.parse(req.query);
    const buildingIds = effectiveBuildingIds(req, query.buildingId);
    const data = await reportService.arrears(buildingIds, {
      year: query.year,
      month: query.month,
    });
    const csv = toCsv(data.items, [
      { header: "Kode", value: (row) => row.code },
      { header: "Nama", value: (row) => row.userName },
      { header: "Gedung", value: (row) => row.buildingName },
      {
        header: "Periode",
        value: (row) => `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`,
      },
      { header: "Jatuh Tempo", value: (row) => row.dueDate },
      { header: "Total", value: (row) => row.totalAmount },
      { header: "Dibayar", value: (row) => row.paidAmount },
      { header: "Tunggakan", value: (row) => row.outstanding },
      { header: "Status", value: (row) => row.status },
    ]);
    sendCsv(res, "tunggakan.csv", csv);
  },

  async cashBalances(req: Request, res: Response) {
    const query = cashBalanceQuerySchema.parse(req.query);
    const buildingIds = effectiveBuildingIds(req, query.buildingId);
    const data = await reportService.cashBalances(buildingIds);
    res.json({ status: "ok", data });
  },

  async incomeVsExpense(req: Request, res: Response) {
    const query = incomeVsExpenseQuerySchema.parse(req.query);
    const buildingIds = effectiveBuildingIds(req, query.buildingId);
    const data = await reportService.incomeVsExpense(buildingIds, {
      from: query.from,
      to: query.to,
    });
    res.json({ status: "ok", data });
  },

  async incomeVsExpenseExport(req: Request, res: Response) {
    const query = incomeVsExpenseQuerySchema.parse(req.query);
    const buildingIds = effectiveBuildingIds(req, query.buildingId);
    const data = await reportService.incomeVsExpense(buildingIds, {
      from: query.from,
      to: query.to,
    });
    const csv = toCsv(data.items, [
      { header: "Kategori", value: (row) => row.categoryName ?? row.categoryId },
      { header: "Arah", value: (row) => row.direction },
      { header: "Total", value: (row) => row.total },
    ]);
    sendCsv(res, "pemasukan-pengeluaran.csv", csv);
  },

  async eventBudget(req: Request, res: Response) {
    const data = await reportService.eventBudgetRealization(paramId(req.params.eventId));
    assertBuildingAccess(req, data.buildingId);
    res.json({ status: "ok", data });
  },
};
