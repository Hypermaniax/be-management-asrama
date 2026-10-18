import type { CashAccount, CashAccountType } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { CashAccount, CashAccountType };

export type CreateCashAccountInput = {
  buildingId: string;
  name: string;
  type?: CashAccountType;
  openingBalance?: number;
};

export type UpdateCashAccountInput = {
  name?: string;
  type?: CashAccountType;
  openingBalance?: number;
};

export const cashAccountRepository = {
  create(data: CreateCashAccountInput) {
    return prisma.cashAccount.create({ data });
  },

  findById(id: string) {
    return prisma.cashAccount.findFirst({ where: { id, deletedAt: null } });
  },

  findByBuildingId(buildingId: string) {
    return prisma.cashAccount.findFirst({
      where: { buildingId, deletedAt: null },
    });
  },

  list(buildingIds?: string[]) {
    return prisma.cashAccount.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  },

  update(id: string, data: UpdateCashAccountInput) {
    return prisma.cashAccount.update({ where: { id }, data });
  },

  softDelete(id: string) {
    return prisma.cashAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type CashAccountRepository = typeof cashAccountRepository;
