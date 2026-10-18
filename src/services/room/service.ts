import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { RoomRepository, RoomStatus } from "../../repositories/rooms.ts";

type RoomDeps = {
  rooms: RoomRepository;
  buildings: BuildingRepository;
};

type CreateRoomInput = {
  buildingId: string;
  number: string;
  capacity: number;
  status?: RoomStatus;
};

type UpdateRoomInput = {
  number?: string;
  capacity?: number;
  status?: RoomStatus;
};

export const createRoomService = ({ rooms, buildings }: RoomDeps) => ({
  async createRoom(data: CreateRoomInput) {
    if (data.capacity <= 0) {
      throw new AppError("Capacity must be greater than 0", 400);
    }
    if (!(await buildings.findById(data.buildingId))) {
      throw new AppError("Building not found", 404);
    }
    if (await rooms.findByNumber(data.buildingId, data.number)) {
      throw new AppError("Room number already exists in this building", 409);
    }
    return rooms.create(data);
  },

  list(buildingIds?: string[]) {
    return rooms.list(buildingIds);
  },

  async getRoom(id: string) {
    const room = await rooms.findById(id);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    return room;
  },

  async updateRoom(id: string, data: UpdateRoomInput) {
    const room = await rooms.findById(id);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    if (data.capacity !== undefined && data.capacity <= 0) {
      throw new AppError("Capacity must be greater than 0", 400);
    }
    if (data.number && data.number !== room.number) {
      const existing = await rooms.findByNumber(room.buildingId, data.number);
      if (existing) {
        throw new AppError("Room number already exists in this building", 409);
      }
    }
    return rooms.update(id, data);
  },

  async softDeleteRoom(id: string) {
    const room = await rooms.findById(id);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    return rooms.softDelete(id);
  },
});

export type RoomService = ReturnType<typeof createRoomService>;
