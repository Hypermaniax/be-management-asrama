import type { Request, Response } from "express";
import { billingService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { auditRequest } from "../middleware/audit.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import {
  listSubmissionQuerySchema,
  rejectSubmissionSchema,
  verifySubmissionSchema,
} from "../validations/billing.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

const currentUserId = (req: Request): string => {
  const { user } = req as AccessRequest;
  if (!user) {
    throw new AppError("Unauthorized", 401);
  }
  return user.id;
};

const scopeBuildingIds = (req: Request): string[] | undefined => {
  const { scope } = req as ScopedRequest;
  if (scope && "buildingIds" in scope) {
    return scope.buildingIds;
  }
  return undefined;
};

export const paymentSubmissionController = {
  async list(req: Request, res: Response) {
    const query = listSubmissionQuerySchema.parse(req.query);
    const data = await billingService.listSubmissions(scopeBuildingIds(req), query);
    res.json({ status: "ok", data });
  },

  async verify(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await billingService.getSubmission(id);
    assertBuildingAccess(req, existing.invoice.buildingId);
    const input = verifySubmissionSchema.parse(req.body ?? {});
    const result = await billingService.verifySubmission(id, currentUserId(req), input);
    await auditRequest(req, {
      action: "VERIFY",
      entity: "paymentSubmission",
      entityId: id,
      after: result,
    });
    res.json({ status: "payment submission verified", data: result });
  },

  async reject(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await billingService.getSubmission(id);
    assertBuildingAccess(req, existing.invoice.buildingId);
    const { reason } = rejectSubmissionSchema.parse(req.body);
    const data = await billingService.rejectSubmission(id, currentUserId(req), reason);
    await auditRequest(req, {
      action: "REJECT",
      entity: "paymentSubmission",
      entityId: id,
      after: data,
    });
    res.json({ status: "payment submission rejected", data });
  },
};
