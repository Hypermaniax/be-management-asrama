import type { Request, Response } from "express";
import { facilityService, roomService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import {
  createFacilitySchema,
  facilityScopeQuerySchema,
  setRoomFacilitiesSchema,
  updateFacilitySchema,
} from "../validations/facility.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

export const facilityController = {
  async create(req: Request, res: Response) {
    const data = createFacilitySchema.parse(req.body);
    const facility = await facilityService.createFacility(data);
    res.status(201).json({ status: "facility created", data: facility });
  },

  async list(req: Request, res: Response) {
    const scope = facilityScopeQuerySchema.parse(req.query.scope);
    const data = await facilityService.list(scope);
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const data = updateFacilitySchema.parse(req.body);
    const facility = await facilityService.updateFacility(paramId(req.params.id), data);
    res.json({ status: "facility updated", data: facility });
  },

  async remove(req: Request, res: Response) {
    await facilityService.softDeleteFacility(paramId(req.params.id));
    res.json({ status: "facility deleted" });
  },

  async listRoomFacilities(req: Request, res: Response) {
    const roomId = paramId(req.params.roomId);
    const room = await roomService.getRoom(roomId);
    assertBuildingAccess(req, room.buildingId);
    const data = await facilityService.getRoomFacilities(roomId);
    res.json({ status: "ok", data });
  },

  async setRoomFacilities(req: Request, res: Response) {
    const roomId = paramId(req.params.roomId);
    const room = await roomService.getRoom(roomId);
    assertBuildingAccess(req, room.buildingId);
    const { items } = setRoomFacilitiesSchema.parse(req.body);
    const data = await facilityService.setRoomFacilities(roomId, items);
    res.json({ status: "room facilities set", data });
  },
};
