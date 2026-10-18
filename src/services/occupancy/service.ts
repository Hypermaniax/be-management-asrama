import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { FeeRuleRepository } from "../../repositories/feeRules.ts";
import type { OccupancyRepository } from "../../repositories/occupancies.ts";
import type { PublicFacilityAssignmentRepository } from "../../repositories/publicFacilityAssignments.ts";
import type { RoomRepository } from "../../repositories/rooms.ts";
import type { UserRepository } from "../../repositories/users.ts";

type OccupancyDeps = {
  occupancies: OccupancyRepository;
  rooms: RoomRepository;
  buildings: BuildingRepository;
  users: UserRepository;
  feeRules: FeeRuleRepository;
  assignments: PublicFacilityAssignmentRepository;
};

type PlaceInput = {
  userId: string;
  roomId: string;
  bedLabel?: string | null;
};

export const createOccupancyService = ({
  occupancies,
  rooms,
  buildings,
  users,
  feeRules,
  assignments,
}: OccupancyDeps) => ({
  async place({ userId, roomId, bedLabel }: PlaceInput) {
    const room = await rooms.findById(roomId);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    if (room.status !== "ACTIVE") {
      throw new AppError("Room is not available", 409);
    }

    const building = await buildings.findById(room.buildingId);
    if (!building) {
      throw new AppError("Building not found", 404);
    }

    const user = await users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    if (user.status !== "ACTIVE") {
      throw new AppError("User is not an active resident", 409);
    }
    if (!user.gender) {
      throw new AppError("User gender is not set", 400);
    }
    if (user.gender !== building.gender) {
      throw new AppError("User gender does not match the building", 409);
    }

    const occupants = await occupancies.countActive(roomId);
    if (occupants >= room.capacity) {
      throw new AppError("Room is full", 409);
    }

    if (await occupancies.findActiveByUser(userId)) {
      throw new AppError("User already has an active occupancy", 409);
    }

    const now = new Date();
    const feeRule = await feeRules.findActiveForBuilding(room.buildingId, now);
    if (!feeRule) {
      throw new AppError("No active fee rule for this building", 409);
    }

    return occupancies.create({
      userId,
      roomId,
      bedLabel: bedLabel ?? null,
      monthlyRateSnapshot: feeRule.defaultMonthlyRate,
      startDate: now,
    });
  },

  list(buildingIds?: string[]) {
    return occupancies.list(buildingIds);
  },

  async getOccupancy(id: string) {
    const occupancy = await occupancies.findById(id);
    if (!occupancy) {
      throw new AppError("Occupancy not found", 404);
    }
    return occupancy;
  },

  async checkout(id: string) {
    const occupancy = await occupancies.findById(id);
    if (!occupancy) {
      throw new AppError("Occupancy not found", 404);
    }
    if (occupancy.status !== "ACTIVE") {
      throw new AppError("Occupancy is not active", 409);
    }

    const ended = await occupancies.end(id, new Date());

    const assigned = await assignments.listAssignedByUser(occupancy.userId);
    for (const assignment of assigned) {
      await assignments.softDelete(assignment.id);
    }

    return ended;
  },
});

export type OccupancyService = ReturnType<typeof createOccupancyService>;
