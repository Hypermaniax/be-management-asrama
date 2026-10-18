import type { ElectionCandidate } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { ElectionCandidate };

export type CreateElectionCandidateInput = {
  electionId: string;
  userId: string;
  orderNo?: number;
  vision?: string | null;
  mission?: string | null;
};

export const electionCandidateRepository = {
  add(data: CreateElectionCandidateInput) {
    return prisma.electionCandidate.create({ data });
  },

  findById(id: string) {
    return prisma.electionCandidate.findFirst({
      where: { id, deletedAt: null },
      include: { user: true },
    });
  },

  findByUser(electionId: string, userId: string) {
    return prisma.electionCandidate.findFirst({
      where: { electionId, userId, deletedAt: null },
    });
  },

  listByElection(electionId: string) {
    return prisma.electionCandidate.findMany({
      where: { electionId, deletedAt: null },
      include: { user: true },
      orderBy: [{ orderNo: "asc" }, { createdAt: "asc" }],
    });
  },

  remove(id: string) {
    return prisma.electionCandidate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type ElectionCandidateRepository = typeof electionCandidateRepository;
