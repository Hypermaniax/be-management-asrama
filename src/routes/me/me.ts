import express from "express";
import multer from "multer";
import { meBillingController } from "../../controller/meBilling.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { requirePermission } from "../../middleware/permission.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const router = express.Router();

router.get(
  "/invoices",
  requirePermission("invoice", "READ"),
  asyncHandler(meBillingController.listInvoices),
);
router.get(
  "/invoices/:id",
  requirePermission("invoice", "READ"),
  asyncHandler(meBillingController.getInvoice),
);
router.post(
  "/payments/proof",
  requirePermission("payment", "CREATE"),
  upload.single("file"),
  asyncHandler(meBillingController.uploadProof),
);
router.post(
  "/payments",
  requirePermission("payment", "CREATE"),
  asyncHandler(meBillingController.createPayment),
);
router.get(
  "/payments",
  requirePermission("payment", "READ"),
  asyncHandler(meBillingController.listPayments),
);
router.get(
  "/payments/:id",
  requirePermission("payment", "READ"),
  asyncHandler(meBillingController.getPayment),
);
