import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { FacilityRepository } from "../../repositories/facilities.ts";
import type {
  PublicFacilityRepository,
  PublicFacStatus,
} from "../../repositories/publicFacilities.ts";
import type { PublicFacilityAssignmentRepository } from "../../repositories/publicFacilityAssignments.ts";

type PublicFacilityDeps = {
  publicFacilities: PublicFacilityRepository;
  assignments: PublicFacilityAssignmentRepository;
  buildings: BuildingRepository;
  facilities: FacilityRepository;
};

type CreatePublicFacilityInput = {
  buildingId: string;
  facilityId: string;
  number?: string | null;
  capacity?: number | null;
  status?: PublicFacStatus;
  note?: string | null;
};

export const createPublicFacilityService = ({
  publicFacilities,
  assignments,
  buildings,
  facilities,
}: PublicFacilityDeps) => ({
  async createPublicFacility(data: CreatePublicFacilityInput) {
    if (!(await buildings.findById(data.buildingId))) {
      throw new AppError("Building not found", 404);
    }
    const facility = await facilities.findById(data.facilityId);
    if (!facility) {
      throw new AppError("Facility not found", 404);
    }
    if (facility.usageMode === "ASSIGNED" && !data.number) {
      throw new AppError("ASSIGNED facility requires a number", 400);
    }
    if (data.number) {
      const existing = await publicFacilities.findByBuildingFacilityNumber(
        data.buildingId,
        data.facilityId,
        data.number,
      );
      if (existing) {
        throw new AppError("Public facility number already exists", 409);
      }
    }
    return publicFacilities.create(data);
  },

  list(buildingIds?: string[]) {
    return publicFacilities.list(buildingIds);
  },

  async getPublicFacility(id: string) {
    const pf = await publicFacilities.findById(id);
    if (!pf) {
      throw new AppError("Public facility not found", 404);
    }
    return pf;
  },

  async updatePublicFacility(
    id: string,
    data: {
      number?: string | null;
      capacity?: number | null;
      status?: PublicFacStatus;
      note?: string | null;
    },
  ) {
    const pf = await publicFacilities.findById(id);
    if (!pf) {
      throw new AppError("Public facility not found", 404);
    }
    if (data.number && data.number !== pf.number) {
      const existing = await publicFacilities.findByBuildingFacilityNumber(
        pf.buildingId,
        pf.facilityId,
        data.number,
      );
      if (existing) {
        throw new AppError("Public facility number already exists", 409);
      }
    }
    return publicFacilities.update(id, data);
  },

  async softDeletePublicFacility(id: string) {
    if (!(await publicFacilities.findById(id))) {
      throw new AppError("Public facility not found", 404);
    }
    return publicFacilities.softDelete(id);
  },

  async assign(publicFacilityId: string, userId: string, slotLabel: string) {
    const pf = await publicFacilities.findById(publicFacilityId);
    if (!pf) {
      throw new AppError("Public facility not found", 404);
    }
    if (pf.facility.usageMode !== "ASSIGNED") {
      throw new AppError("Only ASSIGNED facilities can be assigned", 400);
    }
    if (await assignments.findActiveBySlot(publicFacilityId, slotLabel)) {
      throw new AppError("Slot is already taken", 409);
    }
    if (await assignments.findActiveByUserFacility(userId, pf.facilityId)) {
      throw new AppError("User already has this facility type", 409);
    }
    return assignments.create({
      publicFacilityId,
      userId,
      facilityId: pf.facilityId,
      slotLabel,
    });
  },

  listAssignments(publicFacilityId: string) {
    return assignments.listByPublicFacility(publicFacilityId);
  },

  async getAssignment(id: string) {
    const assignment = await assignments.findById(id);
    if (!assignment) {
      throw new AppError("Assignment not found", 404);
    }
    return assignment;
  },

  release(assignmentId: string) {
    return assignments.softDelete(assignmentId);
  },
});

export type PublicFacilityService = ReturnType<typeof createPublicFacilityService>;
