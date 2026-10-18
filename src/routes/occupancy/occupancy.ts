import express from "express";
import { occupancyController } from "../../controller/occupancy.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud, requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("occupancy"), asyncHandler(occupancyController.place));
router.get("/", crud("occupancy"), asyncHandler(occupancyController.list));
router.post(
  "/:id/checkout",
  requirePermission("occupancy", "UPDATE"),
  asyncHandler(occupancyController.checkout),
);
