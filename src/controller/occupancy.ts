import type { Request, Response } from "express";
import { occupancyService, roomService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import { placeOccupancySchema } from "../validations/occupancy.ts";

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

export const occupancyController = {
  async place(req: Request, res: Response) {
    const data = placeOccupancySchema.parse(req.body);
    const room = await roomService.getRoom(data.roomId);
    assertBuildingAccess(req, room.buildingId);
    const occupancy = await occupancyService.place(data);
    res.status(201).json({ status: "occupancy created", data: occupancy });
  },

  async list(req: Request, res: Response) {
    const data = await occupancyService.list(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async checkout(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await occupancyService.getOccupancy(id);
    assertBuildingAccess(req, existing.room?.buildingId);
    const occupancy = await occupancyService.checkout(id);
    res.json({ status: "occupancy ended", data: occupancy });
  },
};
