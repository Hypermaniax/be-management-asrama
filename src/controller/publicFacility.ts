import type { Request, Response } from "express";
import { publicFacilityService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import {
  assignPublicFacilitySchema,
  createPublicFacilitySchema,
  updatePublicFacilitySchema,
} from "../validations/publicFacility.ts";

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

export const publicFacilityController = {
  async create(req: Request, res: Response) {
    const data = createPublicFacilitySchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const pf = await publicFacilityService.createPublicFacility(data);
    res.status(201).json({ status: "public facility created", data: pf });
  },

  async list(req: Request, res: Response) {
    const data = await publicFacilityService.list(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await publicFacilityService.getPublicFacility(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updatePublicFacilitySchema.parse(req.body);
    const pf = await publicFacilityService.updatePublicFacility(id, data);
    res.json({ status: "public facility updated", data: pf });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await publicFacilityService.getPublicFacility(id);
    assertBuildingAccess(req, existing.buildingId);
    await publicFacilityService.softDeletePublicFacility(id);
    res.json({ status: "public facility deleted" });
  },

  async assign(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await publicFacilityService.getPublicFacility(id);
    assertBuildingAccess(req, existing.buildingId);
    const { userId, slotLabel } = assignPublicFacilitySchema.parse(req.body);
    const assignment = await publicFacilityService.assign(id, userId, slotLabel);
    res.status(201).json({ status: "assigned", data: assignment });
  },

  async listAssignments(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await publicFacilityService.getPublicFacility(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = await publicFacilityService.listAssignments(id);
    res.json({ status: "ok", data });
  },

  async release(req: Request, res: Response) {
    const id = paramId(req.params.assignmentId);
    const assignment = await publicFacilityService.getAssignment(id);
    const pf = await publicFacilityService.getPublicFacility(
      assignment.publicFacilityId,
    );
    assertBuildingAccess(req, pf.buildingId);
    await publicFacilityService.release(id);
    res.json({ status: "released" });
  },
};
