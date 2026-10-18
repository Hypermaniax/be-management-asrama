import type { Request, Response } from "express";
import { buildingService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import {
  buildingSchema,
  updateBuildingSchema,
} from "../validations/building.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

export const buildingController = {
  async create(req: Request, res: Response) {
    const data = buildingSchema.parse(req.body);
    const building = await buildingService.createBuilding(data);
    res.status(201).json({ status: "building created", data: building });
  },

  async list(_req: Request, res: Response) {
    const data = await buildingService.list();
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const data = updateBuildingSchema.parse(req.body);
    const building = await buildingService.updateBuilding(paramId(req.params.id), data);
    res.json({ status: "building updated", data: building });
  },

  async remove(req: Request, res: Response) {
    await buildingService.softDeleteBuilding(paramId(req.params.id));
    res.json({ status: "building deleted" });
  },
};
