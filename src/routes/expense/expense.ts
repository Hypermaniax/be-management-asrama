import express from "express";
import { expenseController } from "../../controller/expense.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("cash"), asyncHandler(expenseController.create));
router.get("/", crud("cash"), asyncHandler(expenseController.list));
router.get("/:id", crud("cash"), asyncHandler(expenseController.get));
