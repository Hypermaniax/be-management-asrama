import type { Request, Response } from "express";
import { billingService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { auditRequest } from "../middleware/audit.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import {
  createSubmissionSchema,
  listMyInvoiceQuerySchema,
  listMySubmissionQuerySchema,
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

export const meBillingController = {
  async listInvoices(req: Request, res: Response) {
    const query = listMyInvoiceQuerySchema.parse(req.query);
    const data = await billingService.listMyInvoices(currentUserId(req), query);
    res.json({ status: "ok", data });
  },

  async getInvoice(req: Request, res: Response) {
    const data = await billingService.getMyInvoice(
      currentUserId(req),
      paramId(req.params.id),
    );
    res.json({ status: "ok", data });
  },

  async uploadProof(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError("File is required", 400);
    }
    const data = await billingService.uploadProof(currentUserId(req), {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
    res.status(201).json({ status: "payment proof uploaded", data });
  },

  async createPayment(req: Request, res: Response) {
    const input = createSubmissionSchema.parse(req.body);
    const submission = await billingService.createSubmission(currentUserId(req), input);
    await auditRequest(req, {
      action: "CREATE",
      entity: "paymentSubmission",
      entityId: submission.id,
      after: submission,
    });
    res.status(201).json({ status: "payment submitted", data: submission });
  },

  async listPayments(req: Request, res: Response) {
    const query = listMySubmissionQuerySchema.parse(req.query);
    const data = await billingService.listMySubmissions(currentUserId(req), query);
    res.json({ status: "ok", data });
  },

  async getPayment(req: Request, res: Response) {
    const data = await billingService.getMySubmission(
      currentUserId(req),
      paramId(req.params.id),
    );
    res.json({ status: "ok", data });
  },
};
