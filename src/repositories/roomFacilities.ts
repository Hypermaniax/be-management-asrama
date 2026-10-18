import { prisma } from "../lib/prisma.ts";

export type RoomFacilityItem = {
  facilityId: string;
  quantity: number;
  note?: string | null;
};

export const roomFacilityRepository = {
  replaceForRoom(roomId: string, items: RoomFacilityItem[]) {
    return prisma.$transaction([
      prisma.roomFacility.deleteMany({ where: { roomId } }),
      prisma.roomFacility.createMany({
        data: items.map((item) => ({
          roomId,
          facilityId: item.facilityId,
          quantity: item.quantity,
          note: item.note ?? null,
        })),
        skipDuplicates: true,
      }),
    ]);
  },

  listByRoom(roomId: string) {
    return prisma.roomFacility.findMany({
      where: { roomId },
      include: { facility: true },
      orderBy: { facilityId: "asc" },
    });
  },

  listByFacility(facilityId: string) {
    return prisma.roomFacility.findMany({
      where: { facilityId },
      include: { room: true },
    });
  },
};

export type RoomFacilityRepository = typeof roomFacilityRepository;
