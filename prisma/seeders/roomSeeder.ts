import type { RoomStatus } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded, requireId, syncSoftRecord } from "./utils.ts";

export type RoomSeed = {
  buildingCode: string;
  number: string;
  capacity: number;
  status?: RoomStatus;
};

export const ROOMS: RoomSeed[] = [
  { buildingCode: "G1", number: "101", capacity: 4 },
  { buildingCode: "G1", number: "102", capacity: 4 },
  { buildingCode: "G1", number: "103", capacity: 4 },
  { buildingCode: "G2", number: "201", capacity: 4 },
  { buildingCode: "G2", number: "202", capacity: 4 },
  { buildingCode: "G2", number: "203", capacity: 4 },
];

export async function seedRooms(buildingIds: Map<string, string>) {
  let count = 0;

  for (const room of ROOMS) {
    const buildingId = requireId(buildingIds, room.buildingCode, "building");
    const data = {
      capacity: room.capacity,
      status: room.status ?? ("ACTIVE" as const),
      deletedAt: null,
    };

    await syncSoftRecord({
      findActive: () =>
        prisma.room.findFirst({
          where: { buildingId, number: room.number, deletedAt: null },
        }),
      findAny: () =>
        prisma.room.findFirst({
          where: { buildingId, number: room.number },
          orderBy: { createdAt: "asc" },
        }),
      create: () =>
        prisma.room.create({ data: { buildingId, number: room.number, ...data } }),
      update: (id) => prisma.room.update({ where: { id }, data }),
    });
    count++;
  }

  logSeeded("rooms", count);
  return count;
}
