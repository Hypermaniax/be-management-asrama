import express from "express";
import multer from "multer";
import { documentController } from "../../controller/document.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud, requirePermission } from "../../middleware/permission.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/types", crud("document"), asyncHandler(documentController.createType));
router.get("/types", crud("document"), asyncHandler(documentController.listTypes));
router.get("/required", crud("document"), asyncHandler(documentController.listRequired));
router.get("/", crud("document"), asyncHandler(documentController.list));
router.post("/request", crud("document"), asyncHandler(documentController.request));
router.post(
  "/upload",
  crud("document"),
  upload.single("file"),
  asyncHandler(documentController.upload),
);
router.post(
  "/:id/verify",
  requirePermission("document", "VERIFY"),
  asyncHandler(documentController.verify),
);
router.post(
  "/:id/reject",
  requirePermission("document", "VERIFY"),
  asyncHandler(documentController.reject),
);
