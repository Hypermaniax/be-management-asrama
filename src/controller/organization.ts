import type { Request, Response } from "express";
import { organizationService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import {
  assignPositionSchema,
  listAssignmentQuerySchema,
  periodSchema,
  positionSchema,
  structureQuerySchema,
  updatePeriodSchema,
  updatePositionSchema,
} from "../validations/organization.ts";

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

export const organizationController = {
  async createPeriod(req: Request, res: Response) {
    const data = periodSchema.parse(req.body);
    const period = await organizationService.createPeriod(data);
    res.status(201).json({ status: "period created", data: period });
  },

  async listPeriods(_req: Request, res: Response) {
    const data = await organizationService.listPeriods();
    res.json({ status: "ok", data });
  },

  async getPeriod(req: Request, res: Response) {
    const data = await organizationService.getPeriod(paramId(req.params.id));
    res.json({ status: "ok", data });
  },

  async updatePeriod(req: Request, res: Response) {
    const data = updatePeriodSchema.parse(req.body);
    const period = await organizationService.updatePeriod(paramId(req.params.id), data);
    res.json({ status: "period updated", data: period });
  },

  async activatePeriod(req: Request, res: Response) {
    const period = await organizationService.activatePeriod(paramId(req.params.id));
    res.json({ status: "period activated", data: period });
  },

  async createPosition(req: Request, res: Response) {
    const data = positionSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId ?? null);
    const position = await organizationService.createPosition(data);
    res.status(201).json({ status: "position created", data: position });
  },

  async listPositions(req: Request, res: Response) {
    const data = await organizationService.listPositions(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async getPosition(req: Request, res: Response) {
    const data = await organizationService.getPosition(paramId(req.params.id));
    res.json({ status: "ok", data });
  },

  async updatePosition(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await organizationService.getPosition(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updatePositionSchema.parse(req.body);
    if (data.buildingId !== undefined && data.buildingId !== existing.buildingId) {
      assertBuildingAccess(req, data.buildingId);
    }
    const position = await organizationService.updatePosition(id, data);
    res.json({ status: "position updated", data: position });
  },

  async removePosition(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await organizationService.getPosition(id);
    assertBuildingAccess(req, existing.buildingId);
    await organizationService.softDeletePosition(id);
    res.json({ status: "position deleted" });
  },

  async assignPosition(req: Request, res: Response) {
    const data = assignPositionSchema.parse(req.body);
    const position = await organizationService.getPosition(data.positionId);
    assertBuildingAccess(req, position.buildingId ?? data.buildingId ?? null);
    const assignment = await organizationService.assignPosition(data);
    res.status(201).json({ status: "position assigned", data: assignment });
  },

  async listAssignments(req: Request, res: Response) {
    const { userId } = listAssignmentQuerySchema.parse(req.query);
    const data = await organizationService.listAssignmentsByUser(userId);
    res.json({ status: "ok", data });
  },

  async endAssignment(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const assignment = await organizationService.getAssignment(id);
    assertBuildingAccess(req, assignment.buildingId);
    const data = await organizationService.endAssignment(id);
    res.json({ status: "position assignment ended", data });
  },

  async structure(req: Request, res: Response) {
    const { periodId } = structureQuerySchema.parse(req.query);
    const data = await organizationService.getStructure(periodId, scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },
};
