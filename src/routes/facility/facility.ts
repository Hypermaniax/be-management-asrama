import express from "express";
import { facilityController } from "../../controller/facility.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.post("/", crud("facility"), asyncHandler(facilityController.create));
router.get("/", crud("facility"), asyncHandler(facilityController.list));
router.get(
  "/rooms/:roomId",
  crud("facility"),
  asyncHandler(facilityController.listRoomFacilities),
);
router.put(
  "/rooms/:roomId",
  crud("facility"),
  asyncHandler(facilityController.setRoomFacilities),
);
router.patch("/:id", crud("facility"), asyncHandler(facilityController.update));
router.delete("/:id", crud("facility"), asyncHandler(facilityController.remove));
