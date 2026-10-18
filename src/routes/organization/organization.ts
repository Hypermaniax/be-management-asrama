import express from "express";
import { organizationController } from "../../controller/organization.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/periods", requirePermission("period", "CREATE"), asyncHandler(organizationController.createPeriod));
router.get("/periods", requirePermission("period", "READ"), asyncHandler(organizationController.listPeriods));
router.get("/periods/:id", requirePermission("period", "READ"), asyncHandler(organizationController.getPeriod));
router.patch("/periods/:id", requirePermission("period", "UPDATE"), asyncHandler(organizationController.updatePeriod));
router.post("/periods/:id/activate", requirePermission("period", "UPDATE"), asyncHandler(organizationController.activatePeriod));

router.post("/positions", requirePermission("position", "CREATE"), asyncHandler(organizationController.createPosition));
router.get("/positions", requirePermission("position", "READ"), asyncHandler(organizationController.listPositions));
router.get("/positions/:id", requirePermission("position", "READ"), asyncHandler(organizationController.getPosition));
router.patch("/positions/:id", requirePermission("position", "UPDATE"), asyncHandler(organizationController.updatePosition));
router.delete("/positions/:id", requirePermission("position", "DELETE"), asyncHandler(organizationController.removePosition));

router.post("/assignments", requirePermission("position", "CREATE"), asyncHandler(organizationController.assignPosition));
router.get("/assignments", requirePermission("position", "READ"), asyncHandler(organizationController.listAssignments));
router.delete("/assignments/:id", requirePermission("position", "UPDATE"), asyncHandler(organizationController.endAssignment));

router.get("/structure", requirePermission("position", "READ"), asyncHandler(organizationController.structure));
