import express from "express";
import { paymentController } from "../../controller/payment.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("payment"), asyncHandler(paymentController.create));
router.get("/", crud("payment"), asyncHandler(paymentController.list));
router.get("/:id", crud("payment"), asyncHandler(paymentController.get));
