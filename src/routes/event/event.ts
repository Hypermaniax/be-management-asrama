import express from "express";
import { eventController } from "../../controller/event.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.get("/me/committees", requirePermission("event", "READ"), asyncHandler(eventController.myCommittees));
router.get("/me/attendance", requirePermission("event", "READ"), asyncHandler(eventController.myAttendance));

router.get("/sessions/:sessionId/attendance", requirePermission("event", "READ"), asyncHandler(eventController.listAttendance));
router.put("/sessions/:sessionId/attendance", requirePermission("event", "UPDATE"), asyncHandler(eventController.setAttendance));
router.delete("/sessions/:sessionId", requirePermission("event", "UPDATE"), asyncHandler(eventController.removeSession));

router.delete("/committees/:committeeId", requirePermission("event", "UPDATE"), asyncHandler(eventController.removeCommittee));
router.delete("/attachments/:attachmentId", requirePermission("event", "UPDATE"), asyncHandler(eventController.removeAttachment));

router.post("/", requirePermission("event", "CREATE"), asyncHandler(eventController.create));
router.get("/", requirePermission("event", "READ"), asyncHandler(eventController.list));
router.get("/:id", requirePermission("event", "READ"), asyncHandler(eventController.detail));
router.patch("/:id", requirePermission("event", "UPDATE"), asyncHandler(eventController.update));
router.delete("/:id", requirePermission("event", "DELETE"), asyncHandler(eventController.remove));
router.post("/:id/status", requirePermission("event", "UPDATE"), asyncHandler(eventController.changeStatus));
router.post("/:id/sessions", requirePermission("event", "UPDATE"), asyncHandler(eventController.addSession));
router.post("/:id/sessions/generate", requirePermission("event", "UPDATE"), asyncHandler(eventController.generateSessions));
router.get("/:id/sessions", requirePermission("event", "READ"), asyncHandler(eventController.listSessions));
router.post("/:id/committees", requirePermission("event", "UPDATE"), asyncHandler(eventController.addCommittee));
router.get("/:id/committees", requirePermission("event", "READ"), asyncHandler(eventController.listCommittees));
router.post("/:id/expenses", requirePermission("event", "UPDATE"), asyncHandler(eventController.recordExpense));
router.post("/:id/attachments", requirePermission("event", "UPDATE"), asyncHandler(eventController.attach));
router.get("/:id/attachments", requirePermission("event", "READ"), asyncHandler(eventController.listAttachments));
