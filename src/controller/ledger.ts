import type { Request, Response } from "express";
import { cashService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import { ledgerQuerySchema, recordIncomeSchema, reversalSchema } from "../validations/cash.ts";

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

export const ledgerController = {
  async list(req: Request, res: Response) {
    const query = ledgerQuerySchema.parse(req.query);
    const data = await cashService.getLedger(scopeBuildingIds(req), {
      cashAccountId: query.cashAccountId,
    });
    res.json({ status: "ok", data });
  },

  async income(req: Request, res: Response) {
    const data = recordIncomeSchema.parse(req.body);
    const category = await cashService.getCategory(data.categoryId);
    assertBuildingAccess(req, category.buildingId);
    const { user } = req as AccessRequest;
    const entry = await cashService.recordManualIncome({
      ...data,
      createdById: user?.id ?? null,
    });
    res.status(201).json({ status: "income recorded", data: entry });
  },

  async reversal(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const entry = await cashService.getLedgerEntry(id);
    const account = await cashService.getCashAccount(entry.cashAccountId);
    assertBuildingAccess(req, account.buildingId);
    const { reason } = reversalSchema.parse(req.body);
    const { user } = req as AccessRequest;
    const reversal = await cashService.reverseLedgerEntry(id, reason, user?.id ?? null);
    res.json({ status: "entry reversed", data: reversal });
  },
};
