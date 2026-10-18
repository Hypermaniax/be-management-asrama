import express from "express";
import { buildingController } from "../../controller/building.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.post("/", crud("building"), asyncHandler(buildingController.create));
router.get("/", crud("building"), asyncHandler(buildingController.list));
router.patch("/:id", crud("building"), asyncHandler(buildingController.update));
router.delete("/:id", crud("building"), asyncHandler(buildingController.remove));
