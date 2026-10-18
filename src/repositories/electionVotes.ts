import type { ElectionVote } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { ElectionVote };

export type CastVoteInput = {
  electionId: string;
  voterId: string;
  candidateId?: string | null;
};

export const electionVoteRepository = {
  cast(data: CastVoteInput) {
    return prisma.electionVote.create({ data });
  },

  findByVoter(electionId: string, voterId: string) {
    return prisma.electionVote.findFirst({ where: { electionId, voterId } });
  },

  listByElection(electionId: string) {
    return prisma.electionVote.findMany({
      where: { electionId },
      orderBy: { castAt: "asc" },
    });
  },

  countByCandidate(electionId: string) {
    return prisma.electionVote.groupBy({
      by: ["candidateId"],
      where: { electionId },
      _count: { _all: true },
    });
  },
};

export type ElectionVoteRepository = typeof electionVoteRepository;
