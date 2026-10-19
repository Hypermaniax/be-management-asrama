import express from "express";
import { reportController } from "../../controller/report.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.get(
  "/arrears",
  requirePermission("report", "READ"),
  asyncHandler(reportController.arrears),
);
router.get(
  "/arrears/export",
  requirePermission("report", "EXPORT"),
  asyncHandler(reportController.arrearsExport),
);
router.get(
  "/cash-balances",
  requirePermission("report", "READ"),
  asyncHandler(reportController.cashBalances),
);
router.get(
  "/income-vs-expense",
  requirePermission("report", "READ"),
  asyncHandler(reportController.incomeVsExpense),
);
router.get(
  "/income-vs-expense/export",
  requirePermission("report", "EXPORT"),
  asyncHandler(reportController.incomeVsExpenseExport),
);
router.get(
  "/events/:eventId/budget",
  requirePermission("report", "READ"),
  asyncHandler(reportController.eventBudget),
);
