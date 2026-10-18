import type { Request, Response } from "express";
import { billingService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import { generateInvoiceSchema, listInvoiceQuerySchema } from "../validations/billing.ts";

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

export const invoiceController = {
  async generate(req: Request, res: Response) {
    const data = generateInvoiceSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const { user } = req as AccessRequest;
    const created = await billingService.generateMonthly({
      ...data,
      createdById: user?.id ?? null,
    });
    res.status(201).json({ status: "invoices generated", data: created });
  },

  async list(req: Request, res: Response) {
    const query = listInvoiceQuerySchema.parse(req.query);
    if (query.buildingId) {
      assertBuildingAccess(req, query.buildingId);
    }
    const data = await billingService.listInvoices(
      query.buildingId ? undefined : scopeBuildingIds(req),
      { status: query.status, year: query.year, month: query.month },
    );
    res.json({ status: "ok", data });
  },

  async get(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const invoice = await billingService.getInvoice(id);
    assertBuildingAccess(req, invoice.buildingId);
    res.json({ status: "ok", data: invoice });
  },

  async void(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await billingService.getInvoice(id);
    assertBuildingAccess(req, existing.buildingId);
    const invoice = await billingService.voidInvoice(id);
    res.json({ status: "invoice void", data: invoice });
  },
};
