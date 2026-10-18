import express from "express";
import { documentController } from "../../controller/document.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.get(
  "/:id",
  requirePermission("document", "READ"),
  asyncHandler(documentController.download),
);
