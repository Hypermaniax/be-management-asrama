import type { RoomStatus } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";

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
    const buildingId = buildingIds.get(room.buildingCode);
    if (!buildingId) continue;

    const existing = await prisma.room.findFirst({
      where: { buildingId, number: room.number, deletedAt: null },
    });

    const data = {
      capacity: room.capacity,
      status: room.status ?? ("ACTIVE" as const),
    };

    if (existing) {
      await prisma.room.update({ where: { id: existing.id }, data });
    } else {
      await prisma.room.create({ data: { buildingId, number: room.number, ...data } });
    }
    count++;
  }

  console.log(`seeded ${count} rooms`);
  return count;
}
