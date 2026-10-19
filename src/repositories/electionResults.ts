import type { ElectionResult } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import type { Db } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export type { ElectionResult };

export type ElectionResultRow = {
  candidateId: string | null;
  votes: number;
  percentage: number;
  rank: number;
};

export const electionResultRepository = {
  async saveMany(electionId: string, rows: ElectionResultRow[], client: Db = prisma) {
    await client.electionResult.deleteMany({ where: { electionId } });
    if (rows.length === 0) return [];
    await client.electionResult.createMany({
      data: rows.map((row) => ({ electionId, ...row })),
    });
    return client.electionResult.findMany({ where: { electionId } });
  },

  listByElection(electionId: string) {
    return prisma.electionResult.findMany({
      where: { electionId },
      include: { candidate: { include: { user: { select: publicUserSelect } } } },
      orderBy: { rank: "asc" },
    });
  },
};

export type ElectionResultRepository = typeof electionResultRepository;
