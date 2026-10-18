import type { Gender, User, UserStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

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
  findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  },

  findById(id: string) {
    return prisma.user.findFirst({ where: { id, deletedAt: null } });
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
    });
  },

  setEmailVerified(id: string) {
    return prisma.user.update({
      where: { id },
      data: { emailVerified: true },
    });
  },

  updateProfile(id: string, data: UserProfileInput) {
    return prisma.user.update({ where: { id }, data });
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
    return prisma.user.update({ where: { id }, data });
  },

  listByBuilding(buildingId: string, status?: UserStatus) {
    return prisma.user.findMany({
      where: { buildingId, deletedAt: null, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
  },

  softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type UserRepository = typeof userRepository;
