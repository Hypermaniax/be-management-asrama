import express from "express";
import { cashAccountController } from "../../controller/cashAccount.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("cash"), asyncHandler(cashAccountController.create));
router.get("/", crud("cash"), asyncHandler(cashAccountController.list));
router.get("/:id", crud("cash"), asyncHandler(cashAccountController.get));
router.patch("/:id", crud("cash"), asyncHandler(cashAccountController.update));
router.delete("/:id", crud("cash"), asyncHandler(cashAccountController.remove));
router.get("/:id/balance", crud("cash"), asyncHandler(cashAccountController.balance));
router.get("/:id/ledger", crud("cash"), asyncHandler(cashAccountController.ledger));
