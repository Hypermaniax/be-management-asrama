import express from "express";
import type { Request, Response } from "express";
import { auditMutations } from "../middleware/audit.ts";
import { requireAccess } from "../middleware/permission.ts";
import { router as auditRouter } from "./audit/audit.ts";
import { router as authRouter } from "./auth/auth.ts";
import { router as buildingRouter } from "./building/building.ts";
import { router as cashAccountRouter } from "./cashAccount/cashAccount.ts";
import { router as categoryRouter } from "./category/category.ts";
import { router as documentRouter } from "./document/document.ts";
import { router as electionRouter } from "./election/election.ts";
import { router as eventRouter } from "./event/event.ts";
import { router as expenseRouter } from "./expense/expense.ts";
import { router as facilityRouter } from "./facility/facility.ts";
import { router as fileRouter } from "./file/file.ts";
import { router as feeRuleRouter } from "./feeRule/feeRule.ts";
import { router as invoiceRouter } from "./invoice/invoice.ts";
import { router as ledgerRouter } from "./ledger/ledger.ts";
import { router as occupancyRouter } from "./occupancy/occupancy.ts";
import { router as organizationRouter } from "./organization/organization.ts";
import { router as paymentRouter } from "./payment/payment.ts";
import { router as publicFacilityRouter } from "./publicFacility/publicFacility.ts";
import { router as rbacRouter } from "./rbac/rbac.ts";
import { router as residentRouter } from "./resident/resident.ts";
import { router as roomRouter } from "./room/room.ts";

export const router = express.Router();

export const PUBLIC_PATHS = new Set([
  "/health",
  "/auth/register",
  "/auth/login",
  "/auth/request-otp",
  "/auth/verify-otp",
]);

export type Mount = { prefix: string; router: express.Router };

export const MOUNTS: Mount[] = [];

const mount = (prefix: string, sub: express.Router) => {
  router.use(prefix, sub);
  MOUNTS.push({ prefix, router: sub });
};

router.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) {
    return next();
  }
  return requireAccess(req, res, next);
});

router.use(auditMutations);

router.get("/health", (_req: Request, res: Response) => {
  return res.json({ status: "health is okay" });
});

mount("/auth", authRouter);
mount("/rbac", rbacRouter);
mount("/buildings", buildingRouter);
mount("/rooms", roomRouter);
mount("/fee-rules", feeRuleRouter);
mount("/facilities", facilityRouter);
mount("/public-facilities", publicFacilityRouter);
mount("/occupancies", occupancyRouter);
mount("/invoices", invoiceRouter);
mount("/payments", paymentRouter);
mount("/cash-accounts", cashAccountRouter);
mount("/categories", categoryRouter);
mount("/expenses", expenseRouter);
mount("/ledger", ledgerRouter);
mount("/events", eventRouter);
mount("/elections", electionRouter);
mount("/organization", organizationRouter);
mount("/residents", residentRouter);
mount("/documents", documentRouter);
mount("/files", fileRouter);
mount("/audit-logs", auditRouter);
