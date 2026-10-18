import type { Period } from "../generated/prisma/client.ts";
import type { Db } from "../lib/prisma.ts";
import { prisma } from "../lib/prisma.ts";

export type { Period };

export type CreatePeriodInput = {
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  decreeNumber?: string | null;
};

export type UpdatePeriodInput = {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  decreeNumber?: string | null;
};

export const periodRepository = {
  create(data: CreatePeriodInput) {
    return prisma.period.create({ data });
  },

  findById(id: string) {
    return prisma.period.findFirst({ where: { id, deletedAt: null } });
  },

  findByCode(code: string) {
    return prisma.period.findFirst({ where: { code, deletedAt: null } });
  },

  list() {
    return prisma.period.findMany({
      where: { deletedAt: null },
      orderBy: [{ startDate: "desc" }],
    });
  },

  findActive() {
    return prisma.period.findFirst({ where: { isActive: true, deletedAt: null } });
  },

  async activate(id: string, client: Db = prisma) {
    await client.period.updateMany({
      where: { isActive: true, deletedAt: null },
      data: { isActive: false },
    });
    return client.period.update({ where: { id }, data: { isActive: true } });
  },

  update(id: string, data: UpdatePeriodInput) {
    return prisma.period.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.period.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  },
};

export type PeriodRepository = typeof periodRepository;
