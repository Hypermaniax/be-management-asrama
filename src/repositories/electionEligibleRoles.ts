import { prisma } from "../lib/prisma.ts";
import type { Db } from "../lib/prisma.ts";

export const electionEligibleRoleRepository = {
  async setForElection(electionId: string, roleIds: string[], client: Db = prisma) {
    await client.electionEligibleRole.deleteMany({ where: { electionId } });
    if (roleIds.length > 0) {
      await client.electionEligibleRole.createMany({
        data: roleIds.map((roleId) => ({ electionId, roleId })),
        skipDuplicates: true,
      });
    }
  },

  listByElection(electionId: string) {
    return prisma.electionEligibleRole.findMany({
      where: { electionId },
      include: { role: true },
      orderBy: { role: { name: "asc" } },
    });
  },
};

export type ElectionEligibleRoleRepository = typeof electionEligibleRoleRepository;
