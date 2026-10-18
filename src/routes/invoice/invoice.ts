import express from "express";
import { invoiceController } from "../../controller/invoice.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post(
  "/generate",
  requirePermission("invoice", "CREATE"),
  asyncHandler(invoiceController.generate),
);
router.get("/", requirePermission("invoice", "READ"), asyncHandler(invoiceController.list));
router.get("/:id", requirePermission("invoice", "READ"), asyncHandler(invoiceController.get));
router.post(
  "/:id/void",
  requirePermission("invoice", "UPDATE"),
  asyncHandler(invoiceController.void),
);
