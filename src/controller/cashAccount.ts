import type { Request, Response } from "express";
import { cashService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { auditRequest } from "../middleware/audit.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import { createCashAccountSchema, updateCashAccountSchema } from "../validations/cash.ts";

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

export const cashAccountController = {
  async create(req: Request, res: Response) {
    const data = createCashAccountSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const account = await cashService.createCashAccount(data);
    await auditRequest(req, {
      action: "CREATE",
      entity: "cashAccount",
      entityId: account.id,
      after: account,
    });
    res.status(201).json({ status: "cash account created", data: account });
  },

  async list(req: Request, res: Response) {
    const data = await cashService.listCashAccounts(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async get(req: Request, res: Response) {
    const account = await cashService.getCashAccount(paramId(req.params.id));
    assertBuildingAccess(req, account.buildingId);
    res.json({ status: "ok", data: account });
  },

  async update(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await cashService.getCashAccount(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updateCashAccountSchema.parse(req.body);
    const account = await cashService.updateCashAccount(id, data);
    await auditRequest(req, {
      action: "UPDATE",
      entity: "cashAccount",
      entityId: id,
      before: existing,
      after: account,
    });
    res.json({ status: "cash account updated", data: account });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await cashService.getCashAccount(id);
    assertBuildingAccess(req, existing.buildingId);
    await cashService.deleteCashAccount(id);
    await auditRequest(req, {
      action: "DELETE",
      entity: "cashAccount",
      entityId: id,
      before: existing,
    });
    res.json({ status: "cash account deleted" });
  },

  async balance(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const account = await cashService.getCashAccount(id);
    assertBuildingAccess(req, account.buildingId);
    const data = await cashService.getBalance(id);
    res.json({ status: "ok", data });
  },

  async ledger(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const account = await cashService.getCashAccount(id);
    assertBuildingAccess(req, account.buildingId);
    const data = await cashService.getLedger(undefined, { cashAccountId: id });
    res.json({ status: "ok", data });
  },
};
