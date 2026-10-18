import express from "express";
import { residentController } from "../../controller/resident.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.get("/", requirePermission("user", "READ"), asyncHandler(residentController.list));
router.get("/:id", requirePermission("user", "READ"), asyncHandler(residentController.get));
router.patch(
  "/:id/profile",
  requirePermission("user", "UPDATE"),
  asyncHandler(residentController.updateProfile),
);
router.post(
  "/:id/submit",
  requirePermission("user", "UPDATE"),
  asyncHandler(residentController.submit),
);
router.post(
  "/:id/approve",
  requirePermission("user", "APPROVE"),
  asyncHandler(residentController.approve),
);
router.post(
  "/:id/reject",
  requirePermission("user", "APPROVE"),
  asyncHandler(residentController.reject),
);
router.post(
  "/:id/checkout",
  requirePermission("user", "UPDATE"),
  asyncHandler(residentController.checkout),
);
