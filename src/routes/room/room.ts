import express from "express";
import { roomController } from "../../controller/room.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("room"), asyncHandler(roomController.create));
router.get("/", crud("room"), asyncHandler(roomController.list));
router.patch("/:id", crud("room"), asyncHandler(roomController.update));
router.delete("/:id", crud("room"), asyncHandler(roomController.remove));
