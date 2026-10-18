import type { Request, Response } from "express";
import { roomService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import { createRoomSchema, updateRoomSchema } from "../validations/room.ts";

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

export const roomController = {
  async create(req: Request, res: Response) {
    const data = createRoomSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const room = await roomService.createRoom(data);
    res.status(201).json({ status: "room created", data: room });
  },

  async list(req: Request, res: Response) {
    const data = await roomService.list(scopeBuildingIds(req));
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await roomService.getRoom(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updateRoomSchema.parse(req.body);
    const room = await roomService.updateRoom(id, data);
    res.json({ status: "room updated", data: room });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await roomService.getRoom(id);
    assertBuildingAccess(req, existing.buildingId);
    await roomService.softDeleteRoom(id);
    res.json({ status: "room deleted" });
  },
};
