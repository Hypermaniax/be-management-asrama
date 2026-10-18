import express from "express";
import { feeRuleController } from "../../controller/feeRule.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("feeRule"), asyncHandler(feeRuleController.create));
router.get("/", crud("feeRule"), asyncHandler(feeRuleController.list));
router.delete("/:id", crud("feeRule"), asyncHandler(feeRuleController.remove));
