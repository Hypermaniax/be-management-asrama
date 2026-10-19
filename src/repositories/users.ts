import type { Gender, User, UserStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { publicUserSelect } from "../lib/userSelect.ts";

export type { Gender, User, UserStatus };

export type UserProfileInput = {
  name?: string | null;
  phone?: string | null;
  buildingId?: string | null;
  nationalId?: string | null;
  gender?: Gender | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  address?: string | null;
};

export const userRepository = {
  // Keeps `password` — used only to verify credentials at login.
  findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  },

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: publicUserSelect,
    });
  },

  create(data: {
    email: string;
    password?: string | null;
    emailVerified?: boolean;
    name?: string | null;
    status?: UserStatus;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password ?? null,
        emailVerified: data.emailVerified ?? false,
        name: data.name ?? null,
        status: data.status ?? "PENDING",
      },
      select: publicUserSelect,
    });
  },

  setEmailVerified(id: string) {
    return prisma.user.update({
      where: { id },
      data: { emailVerified: true },
      select: publicUserSelect,
    });
  },

  updateProfile(id: string, data: UserProfileInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  },

  setStatus(
    id: string,
    data: {
      status: UserStatus;
      submittedAt?: Date | null;
      reviewedById?: string | null;
      reviewedAt?: Date | null;
      rejectionReason?: string | null;
    },
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  },

  listByBuilding(buildingId: string, status?: UserStatus) {
    return prisma.user.findMany({
      where: { buildingId, deletedAt: null, ...(status ? { status } : {}) },
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: publicUserSelect,
    });
  },
};

export type UserRepository = typeof userRepository;
