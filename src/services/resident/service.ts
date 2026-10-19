import { AppError } from "../../lib/errors.ts";
import type { RoleRepository } from "../../repositories/roles.ts";
import type { UserRoleRepository } from "../../repositories/userRoles.ts";
import type {
  UserProfileInput,
  UserRepository,
  UserStatus,
} from "../../repositories/users.ts";

type ResidentDeps = {
  users: UserRepository;
  roles: RoleRepository;
  userRoles: UserRoleRepository;
};

const RESIDENT_ROLE = "PENGHUNI";

export const createResidentService = ({ users, roles, userRoles }: ResidentDeps) => {
  const getResident = async (userId: string) => {
    const user = await users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  };

  return {
    getResident,

    async submitApplication(userId: string, profile: UserProfileInput) {
      await getResident(userId);
      await users.updateProfile(userId, profile);
      return users.setStatus(userId, { status: "PENDING", submittedAt: new Date() });
    },

    async updateProfile(userId: string, profile: UserProfileInput) {
      await getResident(userId);
      return users.updateProfile(userId, profile);
    },

    async approve(userId: string, reviewerId: string, buildingId?: string | null) {
      const user = await getResident(userId);
      if (user.status !== "PENDING") {
        throw new AppError("Only PENDING users can be approved", 400);
      }
      if (buildingId !== undefined) {
        await users.updateProfile(userId, { buildingId });
      }
      const approved = await users.setStatus(userId, {
        status: "ACTIVE",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      });
      // Becoming a resident grants the PENGHUNI role (CALON_PENGHUNI stays for docs access).
      const role = await roles.findByCode(RESIDENT_ROLE);
      if (role) {
        await userRoles.assign({ userId, roleId: role.id });
      }
      return approved;
    },

    async reject(userId: string, reviewerId: string, reason: string) {
      const user = await getResident(userId);
      if (user.status !== "PENDING") {
        throw new AppError("Only PENDING users can be rejected", 400);
      }
      return users.setStatus(userId, {
        status: "REJECTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      });
    },

    async checkout(userId: string) {
      const user = await getResident(userId);
      if (user.status !== "ACTIVE") {
        throw new AppError("Only ACTIVE users can check out", 400);
      }
      return users.setStatus(userId, { status: "CHECKOUT" });
    },

    list(buildingId: string, status?: UserStatus) {
      return users.listByBuilding(buildingId, status);
    },
  };
};

export type ResidentService = ReturnType<typeof createResidentService>;
