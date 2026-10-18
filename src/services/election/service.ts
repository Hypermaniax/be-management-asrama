import { AppError } from "../../lib/errors.ts";
import type { TransactionRunner } from "../../lib/prisma.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { ElectionCandidateRepository } from "../../repositories/electionCandidates.ts";
import type { ElectionEligibleRoleRepository } from "../../repositories/electionEligibleRoles.ts";
import type {
  ElectionResultRepository,
  ElectionResultRow,
} from "../../repositories/electionResults.ts";
import type {
  ElectionRepository,
  ElectionStatus,
  ListElectionFilters,
} from "../../repositories/elections.ts";
import type { ElectionVoteRepository } from "../../repositories/electionVotes.ts";
import type { OccupancyRepository } from "../../repositories/occupancies.ts";
import type { PeriodRepository } from "../../repositories/periods.ts";
import type { PositionAssignmentRepository } from "../../repositories/positionAssignments.ts";
import type { PositionRepository } from "../../repositories/positions.ts";
import type { RoleRepository } from "../../repositories/roles.ts";
import type { UserRepository } from "../../repositories/users.ts";
import type { UserRoleRepository } from "../../repositories/userRoles.ts";

type ElectionDeps = {
  elections: ElectionRepository;
  eligibleRoles: ElectionEligibleRoleRepository;
  candidates: ElectionCandidateRepository;
  votes: ElectionVoteRepository;
  results: ElectionResultRepository;
  users: UserRepository;
  userRoles: UserRoleRepository;
  roles: RoleRepository;
  occupancies: OccupancyRepository;
  periods: PeriodRepository;
  buildings: BuildingRepository;
  positions: PositionRepository;
  positionAssignments: PositionAssignmentRepository;
  transaction: TransactionRunner;
};

type CreateElectionInput = {
  code: string;
  title: string;
  description?: string | null;
  periodId?: string | null;
  buildingId?: string | null;
  startAt: Date;
  endAt: Date;
  allowAbstain?: boolean;
  eligibleRoleIds?: string[];
  createdById: string;
};

type UpdateElectionInput = {
  title?: string;
  description?: string | null;
  periodId?: string | null;
  buildingId?: string | null;
  startAt?: Date;
  endAt?: Date;
  allowAbstain?: boolean;
};

type CandidateInput = {
  userId: string;
  orderNo?: number;
  vision?: string | null;
  mission?: string | null;
};

type FinalizeInput = {
  candidateId?: string;
  positionId: string;
};

const RESIDENT_ROLE = "PENGHUNI";
const DEFAULT_ELIGIBLE_ROLE = "PENGHUNI";

export const createElectionService = ({
  elections,
  eligibleRoles,
  candidates,
  votes,
  results,
  users,
  userRoles,
  roles,
  occupancies,
  periods,
  buildings,
  positions,
  positionAssignments,
  transaction,
}: ElectionDeps) => {
  const getElection = async (id: string) => {
    const election = await elections.findById(id);
    if (!election) {
      throw new AppError("Election not found", 404);
    }
    return election;
  };

  const assertRange = (startAt: Date, endAt: Date) => {
    if (endAt < startAt) {
      throw new AppError("endAt must be on or after startAt", 400);
    }
  };

  const hasRoleCode = async (userId: string, code: string) => {
    const list = await userRoles.listByUser(userId);
    return list.some((userRole) => userRole.role.code === code);
  };

  const isActiveResident = async (userId: string) => {
    if (!(await occupancies.findActiveByUser(userId))) return false;
    return hasRoleCode(userId, RESIDENT_ROLE);
  };

  const computeResultRows = async (electionId: string): Promise<ElectionResultRow[]> => {
    const [candidateList, voteList] = await Promise.all([
      candidates.listByElection(electionId),
      votes.listByElection(electionId),
    ]);
    const rows: { candidateId: string | null; votes: number }[] = candidateList.map(
      (candidate) => ({
        candidateId: candidate.id,
        votes: voteList.filter((vote) => vote.candidateId === candidate.id).length,
      }),
    );
    rows.push({
      candidateId: null,
      votes: voteList.filter((vote) => vote.candidateId === null).length,
    });
    const total = voteList.length;
    rows.sort((a, b) => b.votes - a.votes);
    return rows.map((row, index) => ({
      ...row,
      percentage: total > 0 ? (row.votes / total) * 100 : 0,
      rank: index + 1,
    }));
  };

  const isEligibleVoter = async (electionId: string, userId: string) => {
    const eligible = await eligibleRoles.listByElection(electionId);
    const eligibleRoleIds = new Set(eligible.map((entry) => entry.roleId));
    const list = await userRoles.listByUser(userId);
    if (!list.some((userRole) => eligibleRoleIds.has(userRole.roleId))) {
      return false;
    }
    return Boolean(await occupancies.findActiveByUser(userId));
  };

  return {
    async createElection(input: CreateElectionInput) {
      assertRange(input.startAt, input.endAt);
      if (await elections.findByCode(input.code)) {
        throw new AppError("Election code already exists", 409);
      }
      if (input.periodId && !(await periods.findById(input.periodId))) {
        throw new AppError("Period not found", 404);
      }
      if (input.buildingId && !(await buildings.findById(input.buildingId))) {
        throw new AppError("Building not found", 404);
      }

      let roleIds = input.eligibleRoleIds;
      if (!roleIds || roleIds.length === 0) {
        const fallback = await roles.findByCode(DEFAULT_ELIGIBLE_ROLE);
        roleIds = fallback ? [fallback.id] : [];
      }
      for (const roleId of roleIds) {
        if (!(await roles.findById(roleId))) {
          throw new AppError("Role not found", 404);
        }
      }

      return transaction(async (tx) => {
        const election = await elections.create(
          {
            code: input.code,
            title: input.title,
            description: input.description ?? null,
            periodId: input.periodId ?? null,
            buildingId: input.buildingId ?? null,
            startAt: input.startAt,
            endAt: input.endAt,
            allowAbstain: input.allowAbstain ?? true,
            createdById: input.createdById,
          },
          tx,
        );
        await eligibleRoles.setForElection(election.id, roleIds, tx);
        return election;
      });
    },

    listElections(buildingIds?: string[], filters: ListElectionFilters = {}) {
      return elections.list(buildingIds, filters);
    },

    getElection,

    async getElectionDetail(id: string) {
      const election = await getElection(id);
      const [eligible, candidateList] = await Promise.all([
        eligibleRoles.listByElection(id),
        candidates.listByElection(id),
      ]);
      return {
        ...election,
        eligibleRoles: eligible,
        candidates: candidateList,
      };
    },

    async updateElection(id: string, data: UpdateElectionInput) {
      const election = await getElection(id);
      assertRange(data.startAt ?? election.startAt, data.endAt ?? election.endAt);
      if (data.periodId && !(await periods.findById(data.periodId))) {
        throw new AppError("Period not found", 404);
      }
      if (data.buildingId && !(await buildings.findById(data.buildingId))) {
        throw new AppError("Building not found", 404);
      }
      return elections.update(id, data);
    },

    async deleteElection(id: string) {
      await getElection(id);
      return elections.softDelete(id);
    },

    async setEligibleRoles(electionId: string, roleIds: string[]) {
      await getElection(electionId);
      for (const roleId of roleIds) {
        if (!(await roles.findById(roleId))) {
          throw new AppError("Role not found", 404);
        }
      }
      await eligibleRoles.setForElection(electionId, roleIds);
      return eligibleRoles.listByElection(electionId);
    },

    async openElection(id: string) {
      const election = await getElection(id);
      if (election.status !== "DRAFT" && election.status !== "SCHEDULED") {
        throw new AppError("Only a draft or scheduled election can be opened", 409);
      }
      if (await elections.findOpenByScope(election.buildingId)) {
        throw new AppError("Another election is already open in this scope", 409);
      }
      return elections.setStatus(id, "OPEN");
    },

    async closeElection(id: string) {
      const election = await getElection(id);
      if (election.status !== "OPEN") {
        throw new AppError("Only an open election can be closed", 409);
      }
      return transaction(async (tx) => {
        const closed = await elections.setStatus(id, "CLOSED", tx);
        const rows = await computeResultRows(id);
        await results.saveMany(id, rows, tx);
        return closed;
      });
    },

    async cancelElection(id: string) {
      const election = await getElection(id);
      if (election.status === "DONE" || election.status === "CANCELLED") {
        throw new AppError("Election can no longer be cancelled", 409);
      }
      return elections.setStatus(id, "CANCELLED");
    },

    async addCandidate(electionId: string, data: CandidateInput) {
      const election = await getElection(electionId);
      if (election.status !== "DRAFT" && election.status !== "SCHEDULED") {
        throw new AppError("Candidates can only be added before the election opens", 409);
      }
      if (!(await users.findById(data.userId))) {
        throw new AppError("User not found", 404);
      }
      if (!(await isActiveResident(data.userId))) {
        throw new AppError("Candidate must be an active resident", 400);
      }
      if (await candidates.findByUser(electionId, data.userId)) {
        throw new AppError("User is already a candidate in this election", 409);
      }
      return candidates.add({
        electionId,
        userId: data.userId,
        orderNo: data.orderNo ?? 0,
        vision: data.vision ?? null,
        mission: data.mission ?? null,
      });
    },

    async removeCandidate(electionId: string, candidateId: string) {
      const candidate = await candidates.findById(candidateId);
      if (!candidate || candidate.electionId !== electionId) {
        throw new AppError("Candidate not found", 404);
      }
      return candidates.remove(candidateId);
    },

    listCandidates(electionId: string) {
      return candidates.listByElection(electionId);
    },

    isEligibleVoter,

    async castVote(electionId: string, voterId: string, candidateId?: string | null) {
      const election = await getElection(electionId);
      if (election.status !== "OPEN") {
        throw new AppError("Election is not open for voting", 409);
      }
      if (!(await isEligibleVoter(electionId, voterId))) {
        throw new AppError("You are not an eligible voter", 403);
      }
      if (await votes.findByVoter(electionId, voterId)) {
        throw new AppError("You have already voted", 409);
      }
      let resolvedCandidateId: string | null = candidateId ?? null;
      if (resolvedCandidateId) {
        const candidate = await candidates.findById(resolvedCandidateId);
        if (!candidate || candidate.electionId !== electionId) {
          throw new AppError("Candidate not found", 404);
        }
      } else if (!election.allowAbstain) {
        throw new AppError("Abstain is not allowed in this election", 400);
      }
      return votes.cast({ electionId, voterId, candidateId: resolvedCandidateId });
    },

    async tally(electionId: string) {
      await getElection(electionId);
      const rows = await computeResultRows(electionId);
      return {
        totalVotes: rows.reduce((sum, row) => sum + row.votes, 0),
        rows,
      };
    },

    async publishResult(electionId: string) {
      const election = await getElection(electionId);
      if (election.status !== "CLOSED" && election.status !== "DONE") {
        throw new AppError("Result is not available yet", 403);
      }
      const existing = await results.listByElection(electionId);
      if (existing.length > 0) return existing;
      const rows = await computeResultRows(electionId);
      await results.saveMany(electionId, rows);
      return results.listByElection(electionId);
    },

    async getResult(electionId: string) {
      const election = await getElection(electionId);
      if (election.status !== "CLOSED" && election.status !== "DONE") {
        throw new AppError("Result is not available yet", 403);
      }
      const existing = await results.listByElection(electionId);
      if (existing.length === 0) {
        const rows = await computeResultRows(electionId);
        await results.saveMany(electionId, rows);
      }
      return results.listByElection(electionId);
    },

    async finalize(electionId: string, input: FinalizeInput) {
      const election = await getElection(electionId);
      if (election.status !== "CLOSED") {
        throw new AppError("Only a closed election can be finalized", 409);
      }
      if (!election.periodId) {
        throw new AppError("Election has no period to assign the winner to", 400);
      }
      const position = await positions.findById(input.positionId);
      if (!position) {
        throw new AppError("Position not found", 404);
      }

      let winnerUserId: string;
      if (input.candidateId) {
        const candidate = await candidates.findById(input.candidateId);
        if (!candidate || candidate.electionId !== electionId) {
          throw new AppError("Candidate not found", 404);
        }
        winnerUserId = candidate.userId;
      } else {
        const candidateList = await candidates.listByElection(electionId);
        const voteList = await votes.listByElection(electionId);
        const ranked = candidateList
          .map((candidate) => ({
            candidate,
            votes: voteList.filter((vote) => vote.candidateId === candidate.id).length,
          }))
          .sort((a, b) => b.votes - a.votes);
        if (ranked.length === 0) {
          throw new AppError("No candidates to finalize", 400);
        }
        if (ranked.length > 1 && ranked[0].votes === ranked[1].votes) {
          throw new AppError("Top candidates are tied, specify candidateId", 409);
        }
        winnerUserId = ranked[0].candidate.userId;
      }

      const buildingId = election.buildingId ?? position.buildingId ?? null;

      return transaction(async (tx) => {
        const active = await positionAssignments.listByPosition(position.id);
        for (const assignment of active) {
          if (assignment.isActive && assignment.periodId === election.periodId) {
            await positionAssignments.end(assignment.id, new Date(), tx);
          }
        }
        const assignment = await positionAssignments.create(
          {
            periodId: election.periodId as string,
            positionId: position.id,
            userId: winnerUserId,
            buildingId,
            startDate: new Date(),
          },
          tx,
        );
        const updated = await elections.setStatus(electionId, "DONE", tx);
        return { election: updated, assignment };
      });
    },
  };
};

export type ElectionService = ReturnType<typeof createElectionService>;
export type { ElectionStatus };
