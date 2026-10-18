import type { Request, Response } from "express";
import { auditService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { listAuditQuerySchema } from "../validations/audit.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

export const auditController = {
  async list(req: Request, res: Response) {
    const filters = listAuditQuerySchema.parse(req.query);
    const data = await auditService.list(filters);
    res.json({ status: "ok", data });
  },

  async get(req: Request, res: Response) {
    const data = await auditService.getById(paramId(req.params.id));
    res.json({ status: "ok", data });
  },
};
