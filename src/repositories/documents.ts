import type { DocStatus } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { DocStatus };

export const documentRepository = {
  create(data: {
    userId: string;
    documentTypeId: string;
    status?: DocStatus;
    fileId?: string | null;
    requestedById?: string | null;
    version?: number;
  }) {
    return prisma.documentSubmission.create({ data });
  },

  findById(id: string) {
    return prisma.documentSubmission.findFirst({
      where: { id, deletedAt: null },
      include: { documentType: true, file: true },
    });
  },

  findLatest(userId: string, documentTypeId: string) {
    return prisma.documentSubmission.findFirst({
      where: { userId, documentTypeId, deletedAt: null },
      orderBy: { version: "desc" },
    });
  },

  listByUser(userId: string) {
    return prisma.documentSubmission.findMany({
      where: { userId, deletedAt: null },
      include: { documentType: true, file: true },
      orderBy: { createdAt: "desc" },
    });
  },

  update(
    id: string,
    data: {
      status?: DocStatus;
      fileId?: string | null;
      reviewedById?: string | null;
      reviewedAt?: Date | null;
      rejectionReason?: string | null;
      note?: string | null;
    },
  ) {
    return prisma.documentSubmission.update({ where: { id }, data });
  },
};

export type DocumentRepository = typeof documentRepository;
