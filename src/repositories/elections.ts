import type { Election, ElectionStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import type { Db } from "../lib/prisma.ts";

export type { Election, ElectionStatus };

export type CreateElectionInput = {
  code: string;
  title: string;
  description?: string | null;
  periodId?: string | null;
  buildingId?: string | null;
  startAt: Date;
  endAt: Date;
  allowAbstain?: boolean;
  createdById: string;
};

export type UpdateElectionInput = {
  title?: string;
  description?: string | null;
  periodId?: string | null;
  buildingId?: string | null;
  startAt?: Date;
  endAt?: Date;
  allowAbstain?: boolean;
};

export type ListElectionFilters = {
  status?: ElectionStatus;
};

export const electionRepository = {
  create(data: CreateElectionInput, client: Db = prisma) {
    return client.election.create({ data });
  },

  findById(id: string) {
    return prisma.election.findFirst({
      where: { id, deletedAt: null },
      include: { period: true, building: true },
    });
  },

  findByCode(code: string) {
    return prisma.election.findFirst({ where: { code, deletedAt: null } });
  },

  findOpenByScope(buildingId?: string | null) {
    return prisma.election.findFirst({
      where: { status: "OPEN", buildingId: buildingId ?? null, deletedAt: null },
    });
  },

  list(buildingIds?: string[], filters: ListElectionFilters = {}) {
    return prisma.election.findMany({
      where: {
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(buildingIds
          ? { OR: [{ buildingId: null }, { buildingId: { in: buildingIds } }] }
          : {}),
      },
      include: { period: true, building: true },
      orderBy: { startAt: "desc" },
    });
  },

  update(id: string, data: UpdateElectionInput) {
    return prisma.election.update({ where: { id }, data });
  },

  setStatus(id: string, status: ElectionStatus, client: Db = prisma) {
    return client.election.update({ where: { id }, data: { status } });
  },

  softDelete(id: string) {
    return prisma.election.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type ElectionRepository = typeof electionRepository;
