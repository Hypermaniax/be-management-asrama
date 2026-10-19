import { prisma } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export const publicFacilityAssignmentRepository = {
  create(data: {
    publicFacilityId: string;
    userId: string;
    facilityId: string;
    slotLabel: string;
  }) {
    return prisma.publicFacilityAssignment.create({ data });
  },

  findById(id: string) {
    return prisma.publicFacilityAssignment.findFirst({
      where: { id, deletedAt: null },
    });
  },

  findActiveBySlot(publicFacilityId: string, slotLabel: string) {
    return prisma.publicFacilityAssignment.findFirst({
      where: { publicFacilityId, slotLabel, deletedAt: null },
    });
  },

  findActiveByUserFacility(userId: string, facilityId: string) {
    return prisma.publicFacilityAssignment.findFirst({
      where: { userId, facilityId, deletedAt: null },
    });
  },

  listByUser(userId: string) {
    return prisma.publicFacilityAssignment.findMany({
      where: { userId, deletedAt: null },
      include: { publicFacility: { include: { facility: true } } },
    });
  },

  listAssignedByUser(userId: string) {
    return prisma.publicFacilityAssignment.findMany({
      where: { userId, deletedAt: null, facility: { usageMode: "ASSIGNED" } },
    });
  },

  listByPublicFacility(publicFacilityId: string) {
    return prisma.publicFacilityAssignment.findMany({
      where: { publicFacilityId, deletedAt: null },
      include: { user: { select: publicUserSelect } },
      orderBy: { slotLabel: "asc" },
    });
  },

  softDelete(id: string) {
    return prisma.publicFacilityAssignment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type PublicFacilityAssignmentRepository =
  typeof publicFacilityAssignmentRepository;
