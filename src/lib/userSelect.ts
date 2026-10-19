import type { Prisma } from "../generated/prisma/client.ts";

// Every field of `User` except `password`, so user objects can be returned in
// API responses without leaking the password hash.
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  emailVerified: true,
  buildingId: true,
  nationalId: true,
  gender: true,
  guardianName: true,
  guardianPhone: true,
  address: true,
  status: true,
  submittedAt: true,
  reviewedById: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;
