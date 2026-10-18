import type { PositionAssignment } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { PositionAssignment };

export type CreatePositionAssignmentInput = {
  periodId: string;
  positionId: string;
  userId: string;
  buildingId?: string | null;
  startDate: Date;
  decreeNumber?: string | null;
};

export const positionAssignmentRepository = {
  create(data: CreatePositionAssignmentInput) {
    return prisma.positionAssignment.create({ data });
  },

  findById(id: string) {
    return prisma.positionAssignment.findFirst({
      where: { id, deletedAt: null },
      include: { position: true, user: true },
    });
  },

  findActiveByUser(userId: string) {
    return prisma.positionAssignment.findMany({
      where: { userId, isActive: true, deletedAt: null },
      include: { position: true, period: true },
      orderBy: { startDate: "desc" },
    });
  },

  listByUser(userId: string) {
    return prisma.positionAssignment.findMany({
      where: { userId, deletedAt: null },
      include: { position: true, period: true },
      orderBy: { startDate: "desc" },
    });
  },

  listByPeriod(periodId: string) {
    return prisma.positionAssignment.findMany({
      where: { periodId, deletedAt: null },
      include: { position: true, user: true },
      orderBy: { startDate: "asc" },
    });
  },

  listByPosition(positionId: string) {
    return prisma.positionAssignment.findMany({
      where: { positionId, deletedAt: null },
      include: { period: true, user: true },
      orderBy: { startDate: "desc" },
    });
  },

  end(id: string, endDate: Date) {
    return prisma.positionAssignment.update({
      where: { id },
      data: { isActive: false, endDate, deletedAt: new Date() },
    });
  },
};

export type PositionAssignmentRepository = typeof positionAssignmentRepository;
