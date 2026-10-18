import type { Request, Response } from "express";
import { billingService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import { listPaymentQuerySchema, recordPaymentSchema } from "../validations/billing.ts";

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

export const paymentController = {
  async create(req: Request, res: Response) {
    const data = recordPaymentSchema.parse(req.body);
    const { user } = req as AccessRequest;
    const payment = await billingService.recordPayment({
      ...data,
      receivedById: user?.id ?? null,
    });
    res.status(201).json({ status: "payment recorded", data: payment });
  },

  async list(req: Request, res: Response) {
    const query = listPaymentQuerySchema.parse(req.query);
    const data = await billingService.listPayments(scopeBuildingIds(req), {
      userId: query.userId,
    });
    res.json({ status: "ok", data });
  },

  async get(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const payment = await billingService.getPayment(id);
    res.json({ status: "ok", data: payment });
  },
};
