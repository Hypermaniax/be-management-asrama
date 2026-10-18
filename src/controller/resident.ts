import type { Request, Response } from "express";
import { residentService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import {
  approveResidentSchema,
  listResidentQuerySchema,
  profileSchema,
  rejectResidentSchema,
} from "../validations/resident.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

const reviewerId = (req: Request): string => {
  const { user } = req as AccessRequest;
  if (!user) {
    throw new AppError("Unauthorized", 401);
  }
  return user.id;
};

export const residentController = {
  async list(req: Request, res: Response) {
    const { buildingId, status } = listResidentQuerySchema.parse(req.query);
    assertBuildingAccess(req, buildingId);
    const data = await residentService.list(buildingId, status);
    res.json({ status: "ok", data });
  },

  async get(req: Request, res: Response) {
    const user = await residentService.getResident(paramId(req.params.id));
    if (user.buildingId) {
      assertBuildingAccess(req, user.buildingId);
    }
    res.json({ status: "ok", data: user });
  },

  async submit(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const user = await residentService.getResident(id);
    if (user.buildingId) {
      assertBuildingAccess(req, user.buildingId);
    }
    const profile = profileSchema.parse(req.body);
    const data = await residentService.submitApplication(id, profile);
    res.json({ status: "application submitted", data });
  },

  async updateProfile(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const user = await residentService.getResident(id);
    if (user.buildingId) {
      assertBuildingAccess(req, user.buildingId);
    }
    const profile = profileSchema.parse(req.body);
    const data = await residentService.updateProfile(id, profile);
    res.json({ status: "profile updated", data });
  },

  async approve(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const { buildingId } = approveResidentSchema.parse(req.body);
    if (buildingId) {
      assertBuildingAccess(req, buildingId);
    }
    const data = await residentService.approve(id, reviewerId(req), buildingId);
    res.json({ status: "resident approved", data });
  },

  async reject(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const { reason } = rejectResidentSchema.parse(req.body);
    const data = await residentService.reject(id, reviewerId(req), reason);
    res.json({ status: "resident rejected", data });
  },

  async checkout(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const user = await residentService.getResident(id);
    if (user.buildingId) {
      assertBuildingAccess(req, user.buildingId);
    }
    const data = await residentService.checkout(id);
    res.json({ status: "resident checked out", data });
  },
};
