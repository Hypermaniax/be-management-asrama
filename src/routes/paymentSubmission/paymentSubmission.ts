import express from "express";
import { paymentSubmissionController } from "../../controller/paymentSubmission.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.get(
  "/",
  requirePermission("payment", "READ"),
  asyncHandler(paymentSubmissionController.list),
);
router.post(
  "/:id/verify",
  requirePermission("payment", "APPROVE"),
  asyncHandler(paymentSubmissionController.verify),
);
router.post(
  "/:id/reject",
  requirePermission("payment", "APPROVE"),
  asyncHandler(paymentSubmissionController.reject),
);
