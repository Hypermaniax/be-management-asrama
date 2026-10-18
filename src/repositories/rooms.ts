import type { Room, RoomStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { Room, RoomStatus };

export const roomRepository = {
  create(data: {
    buildingId: string;
    number: string;
    capacity: number;
    status?: RoomStatus;
  }) {
    return prisma.room.create({ data });
  },

  findById(id: string) {
    return prisma.room.findFirst({ where: { id, deletedAt: null } });
  },

  findByNumber(buildingId: string, number: string) {
    return prisma.room.findFirst({
      where: { buildingId, number, deletedAt: null },
    });
  },

  findByBuilding(buildingId: string) {
    return prisma.room.findMany({
      where: { buildingId, deletedAt: null },
      orderBy: { number: "asc" },
    });
  },

  list(buildingIds?: string[]) {
    return prisma.room.findMany({
      where: {
        deletedAt: null,
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
      orderBy: [{ buildingId: "asc" }, { number: "asc" }],
    });
  },

  update(
    id: string,
    data: {
      number?: string;
      capacity?: number;
      status?: RoomStatus;
    },
  ) {
    return prisma.room.update({ where: { id }, data });
  },

  countActiveOccupants(roomId: string) {
    return prisma.occupancy.count({
      where: { roomId, status: "ACTIVE", deletedAt: null },
    });
  },

  softDelete(id: string) {
    return prisma.room.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type RoomRepository = typeof roomRepository;
