import { AppError } from "../../lib/errors.ts";
import type {
  FacilityCategory,
  FacilityRepository,
  FacilityScope,
  FacilityUsage,
} from "../../repositories/facilities.ts";
import type { RoomRepository } from "../../repositories/rooms.ts";
import type {
  RoomFacilityItem,
  RoomFacilityRepository,
} from "../../repositories/roomFacilities.ts";

type FacilityDeps = {
  facilities: FacilityRepository;
  roomFacilities: RoomFacilityRepository;
  rooms: RoomRepository;
};

type CreateFacilityInput = {
  code: string;
  name: string;
  scope: FacilityScope;
  usageMode: FacilityUsage;
  category: FacilityCategory;
};

export const createFacilityService = ({
  facilities,
  roomFacilities,
  rooms,
}: FacilityDeps) => ({
  async createFacility(data: CreateFacilityInput) {
    if (await facilities.findByCode(data.code)) {
      throw new AppError("Facility code already exists", 409);
    }
    return facilities.create(data);
  },

  list(scope?: FacilityScope) {
    return facilities.list(scope);
  },

  async updateFacility(
    id: string,
    data: {
      name?: string;
      usageMode?: FacilityUsage;
      category?: FacilityCategory;
      isActive?: boolean;
    },
  ) {
    if (!(await facilities.findById(id))) {
      throw new AppError("Facility not found", 404);
    }
    return facilities.update(id, data);
  },

  async softDeleteFacility(id: string) {
    if (!(await facilities.findById(id))) {
      throw new AppError("Facility not found", 404);
    }
    return facilities.softDelete(id);
  },

  async setRoomFacilities(roomId: string, items: RoomFacilityItem[]) {
    if (!(await rooms.findById(roomId))) {
      throw new AppError("Room not found", 404);
    }
    for (const item of items) {
      const facility = await facilities.findById(item.facilityId);
      if (!facility) {
        throw new AppError("Facility not found", 404);
      }
      if (facility.scope !== "ROOM") {
        throw new AppError("Only ROOM facilities can be attached to a room", 400);
      }
      if (item.quantity <= 0) {
        throw new AppError("Quantity must be greater than 0", 400);
      }
    }
    await roomFacilities.replaceForRoom(roomId, items);
    return roomFacilities.listByRoom(roomId);
  },

  getRoomFacilities(roomId: string) {
    return roomFacilities.listByRoom(roomId);
  },
});

export type FacilityService = ReturnType<typeof createFacilityService>;
