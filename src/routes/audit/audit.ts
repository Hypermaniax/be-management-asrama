import express from "express";
import { auditController } from "../../controller/audit.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.get("/", requirePermission("audit", "READ"), asyncHandler(auditController.list));
router.get("/:id", requirePermission("audit", "READ"), asyncHandler(auditController.get));
