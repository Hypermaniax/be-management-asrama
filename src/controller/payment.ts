import type { Request, Response } from "express";
import { billingService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { permissionCode } from "../lib/permission.ts";
import { auditRequest } from "../middleware/audit.ts";
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
    await auditRequest(req, {
      action: "CREATE",
      entity: "payment",
      entityId: payment.id,
      after: payment,
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
    const { access, user, scope } = req as ScopedRequest;
    if (!user || !access) {
      throw new AppError("Unauthorized", 401);
    }
    if (payment.userId !== user.id) {
      const buildingId = payment.user?.buildingId;
      const inScope =
        !scope ||
        "all" in scope ||
        (buildingId !== null && buildingId !== undefined && scope.buildingIds.includes(buildingId));
      const canReview =
        access.isSuperAdmin ||
        (access.permissions.has(permissionCode("payment", "APPROVE")) && inScope);
      if (!canReview) {
        throw new AppError("Forbidden", 403);
      }
    }
    res.json({ status: "ok", data: payment });
  },
};
