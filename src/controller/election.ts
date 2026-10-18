import type { Request, Response } from "express";
import { electionService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { ScopedRequest } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import {
  candidateSchema,
  electionSchema,
  eligibleRoleSchema,
  finalizeSchema,
  listElectionQuerySchema,
  updateElectionSchema,
  voteSchema,
} from "../validations/election.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

const scopeBuildingIds = (req: Request): string[] | undefined => {
  const { scope } = req as ScopedRequest;
  if (scope && "buildingIds" in scope) {
    return scope.buildingIds;
  }
  return undefined;
};

export const electionController = {
  async create(req: Request, res: Response) {
    const data = electionSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId ?? null);
    const election = await electionService.createElection({
      ...data,
      createdById: (req as AccessRequest).user!.id,
    });
    res.status(201).json({ status: "election created", data: election });
  },

  async list(req: Request, res: Response) {
    const filters = listElectionQuerySchema.parse(req.query);
    const data = await electionService.listElections(scopeBuildingIds(req), filters);
    res.json({ status: "ok", data });
  },

  async detail(req: Request, res: Response) {
    const data = await electionService.getElectionDetail(paramId(req.params.id));
    res.json({ status: "ok", data });
  },

  async update(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = updateElectionSchema.parse(req.body);
    if (data.buildingId !== undefined) {
      assertBuildingAccess(req, data.buildingId);
    }
    const election = await electionService.updateElection(id, data);
    res.json({ status: "election updated", data: election });
  },

  async remove(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    await electionService.deleteElection(id);
    res.json({ status: "election deleted" });
  },

  async setEligibleRoles(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const { roleIds } = eligibleRoleSchema.parse(req.body);
    const data = await electionService.setEligibleRoles(id, roleIds);
    res.json({ status: "eligible roles updated", data });
  },

  async open(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = await electionService.openElection(id);
    res.json({ status: "election opened", data });
  },

  async close(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = await electionService.closeElection(id);
    res.json({ status: "election closed", data });
  },

  async cancel(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = await electionService.cancelElection(id);
    res.json({ status: "election cancelled", data });
  },

  async addCandidate(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = candidateSchema.parse(req.body);
    const candidate = await electionService.addCandidate(id, data);
    res.status(201).json({ status: "candidate added", data: candidate });
  },

  async listCandidates(req: Request, res: Response) {
    const data = await electionService.listCandidates(paramId(req.params.id));
    res.json({ status: "ok", data });
  },

  async removeCandidate(req: Request, res: Response) {
    await electionService.removeCandidate(
      paramId(req.params.id),
      paramId(req.params.candidateId),
    );
    res.json({ status: "candidate removed" });
  },

  async vote(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const { candidateId } = voteSchema.parse(req.body);
    const vote = await electionService.castVote(
      id,
      (req as AccessRequest).user!.id,
      candidateId ?? null,
    );
    res.status(201).json({ status: "vote cast", data: vote });
  },

  async result(req: Request, res: Response) {
    const data = await electionService.getResult(paramId(req.params.id));
    res.json({ status: "ok", data });
  },

  async finalize(req: Request, res: Response) {
    const id = paramId(req.params.id);
    const existing = await electionService.getElection(id);
    assertBuildingAccess(req, existing.buildingId);
    const data = finalizeSchema.parse(req.body);
    const result = await electionService.finalize(id, data);
    res.json({ status: "election finalized", data: result });
  },
};
