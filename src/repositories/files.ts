import type { File } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type { File };

export const fileRepository = {
  create(data: {
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    uploadedById: string;
  }) {
    return prisma.file.create({ data });
  },

  findById(id: string) {
    return prisma.file.findFirst({ where: { id, deletedAt: null } });
  },

  softDelete(id: string) {
    return prisma.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export type FileRepository = typeof fileRepository;
