import type { Request, Response } from "express";
import { cashService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { auditRequest } from "../middleware/audit.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import {
  createCategorySchema,
  listCategoryQuerySchema,
  updateCategorySchema,
} from "../validations/cash.ts";

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

export const categoryController = {
  async create(req: Request, res: Response) {
    const data = createCategorySchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const category = await cashService.createCategory(data);
    await auditRequest(req, {
      action: "CREATE",
      entity: "category",
      entityId: category.id,
      after: category,
    });
    res.status(201).json({ status: "category created", data: category });
  },

  async list(req: Request, res: Response) {
    const query = listCategoryQuerySchema.parse(req.query);
    const data = await cashService.listCategories(scopeBuildingIds(req), query.kind);
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await cashService.getCategory(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updateCategorySchema.parse(req.body);
    const category = await cashService.updateCategory(id, data);
    await auditRequest(req, {
      action: "UPDATE",
      entity: "category",
      entityId: id,
      before: existing,
      after: category,
    });
    res.json({ status: "category updated", data: category });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await cashService.getCategory(id);
    assertBuildingAccess(req, existing.buildingId);
    await cashService.deleteCategory(id);
    await auditRequest(req, {
      action: "DELETE",
      entity: "category",
      entityId: id,
      before: existing,
    });
    res.json({ status: "category deleted" });
  },
};
