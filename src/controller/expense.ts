import type { Request, Response } from "express";
import { cashService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { auditRequest } from "../middleware/audit.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import { recordExpenseSchema } from "../validations/cash.ts";

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

export const expenseController = {
  async create(req: Request, res: Response) {
    const data = recordExpenseSchema.parse(req.body);
    const category = await cashService.getCategory(data.categoryId);
    assertBuildingAccess(req, category.buildingId);
    const { user } = req as AccessRequest;
    const expense = await cashService.recordExpense({
      ...data,
      createdById: user?.id ?? null,
    });
    await auditRequest(req, {
      action: "CREATE",
      entity: "expense",
      entityId: expense.id,
      after: expense,
    });
    res.status(201).json({ status: "expense recorded", data: expense });
  },

  async list(req: Request, res: Response) {
    const data = await cashService.listExpenses(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async get(req: Request, res: Response) {
    const expense = await cashService.getExpense(paramId(req.params.id));
    const account = await cashService.getCashAccount(expense.cashAccountId);
    assertBuildingAccess(req, account.buildingId);
    res.json({ status: "ok", data: expense });
  },
};
