import express from "express";
import { electionController } from "../../controller/election.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", requirePermission("election", "CREATE"), asyncHandler(electionController.create));
router.get("/", requirePermission("election", "READ"), asyncHandler(electionController.list));
router.get("/:id", requirePermission("election", "READ"), asyncHandler(electionController.detail));
router.patch("/:id", requirePermission("election", "UPDATE"), asyncHandler(electionController.update));
router.delete("/:id", requirePermission("election", "DELETE"), asyncHandler(electionController.remove));

router.put("/:id/eligible-roles", requirePermission("election", "UPDATE"), asyncHandler(electionController.setEligibleRoles));
router.post("/:id/open", requirePermission("election", "UPDATE"), asyncHandler(electionController.open));
router.post("/:id/close", requirePermission("election", "UPDATE"), asyncHandler(electionController.close));
router.post("/:id/cancel", requirePermission("election", "UPDATE"), asyncHandler(electionController.cancel));

router.get("/:id/candidates", requirePermission("election", "READ"), asyncHandler(electionController.listCandidates));
router.post("/:id/candidates", requirePermission("election", "UPDATE"), asyncHandler(electionController.addCandidate));
router.delete("/:id/candidates/:candidateId", requirePermission("election", "UPDATE"), asyncHandler(electionController.removeCandidate));

router.post("/:id/vote", requirePermission("election", "READ"), asyncHandler(electionController.vote));
router.get("/:id/result", requirePermission("election", "READ"), asyncHandler(electionController.result));
router.post("/:id/finalize", requirePermission("election", "UPDATE"), asyncHandler(electionController.finalize));
