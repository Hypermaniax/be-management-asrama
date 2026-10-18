import type { Request, Response } from "express";
import { feeRuleService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import { createFeeRuleSchema } from "../validations/feeRule.ts";

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

export const feeRuleController = {
  async create(req: Request, res: Response) {
    const data = createFeeRuleSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const rule = await feeRuleService.createFeeRule(data);
    res.status(201).json({ status: "fee rule created", data: rule });
  },

  async list(req: Request, res: Response) {
    const data = await feeRuleService.list(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const rule = await feeRuleService.getFeeRule(id);
    assertBuildingAccess(req, rule.buildingId);
    await feeRuleService.softDeleteFeeRule(id);
    res.json({ status: "fee rule deleted" });
  },
};
