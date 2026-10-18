import express from "express";
import { publicFacilityController } from "../../controller/publicFacility.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("facility"), asyncHandler(publicFacilityController.create));
router.get("/", crud("facility"), asyncHandler(publicFacilityController.list));
router.delete(
  "/assignments/:assignmentId",
  crud("facility"),
  asyncHandler(publicFacilityController.release),
);
router.patch("/:id", crud("facility"), asyncHandler(publicFacilityController.update));
router.delete("/:id", crud("facility"), asyncHandler(publicFacilityController.remove));
router.post(
  "/:id/assign",
  crud("facility"),
  asyncHandler(publicFacilityController.assign),
);
router.get(
  "/:id/assignments",
  crud("facility"),
  asyncHandler(publicFacilityController.listAssignments),
);
