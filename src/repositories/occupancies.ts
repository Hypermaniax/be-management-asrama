import type { Occupancy, OccupancyStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export type { Occupancy, OccupancyStatus };

export const occupancyRepository = {
  create(data: {
    userId: string;
    roomId: string;
    bedLabel?: string | null;
    monthlyRateSnapshot: number;
    startDate: Date;
  }) {
    return prisma.occupancy.create({ data });
  },

  findById(id: string) {
    return prisma.occupancy.findFirst({
      where: { id, deletedAt: null },
      include: { room: true },
    });
  },

  findActiveByUser(userId: string) {
    return prisma.occupancy.findFirst({
      where: { userId, status: "ACTIVE", deletedAt: null },
    });
  },

  listActiveByRoom(roomId: string) {
    return prisma.occupancy.findMany({
      where: { roomId, status: "ACTIVE", deletedAt: null },
      orderBy: { startDate: "asc" },
    });
  },

  listActiveByBuilding(buildingId: string) {
    return prisma.occupancy.findMany({
      where: { status: "ACTIVE", deletedAt: null, room: { buildingId } },
      include: { room: true },
      orderBy: { startDate: "asc" },
    });
  },

  countActive(roomId: string) {
    return prisma.occupancy.count({
      where: { roomId, status: "ACTIVE", deletedAt: null },
    });
  },

  end(id: string, endDate: Date) {
    return prisma.occupancy.update({
      where: { id },
      data: { status: "ENDED", endDate },
    });
  },

  list(buildingIds?: string[]) {
    return prisma.occupancy.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { room: { buildingId: { in: buildingIds } } } : {}),
      },
      include: { room: true, user: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" },
    });
  },
};

export type OccupancyRepository = typeof occupancyRepository;
