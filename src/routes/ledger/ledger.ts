import express from "express";
import { ledgerController } from "../../controller/ledger.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.get("/", requirePermission("cash", "READ"), asyncHandler(ledgerController.list));
router.post(
  "/income",
  requirePermission("cash", "CREATE"),
  asyncHandler(ledgerController.income),
);
router.post(
  "/:id/reversal",
  requirePermission("cash", "UPDATE"),
  asyncHandler(ledgerController.reversal),
);
