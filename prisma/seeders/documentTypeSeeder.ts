import { prisma } from "../../src/lib/prisma.ts";
import { MB, logSeeded, requireId, syncSoftRecord } from "./utils.ts";

export type DocumentTypeSeed = {
  buildingCode: string;
  code: string;
  name: string;
  isRequiredByDefault: boolean;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  sortOrder: number;
};

const MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const DOCUMENT_TYPES: DocumentTypeSeed[] = [
  {
    buildingCode: "G1",
    code: "KTP",
    name: "KTP",
    isRequiredByDefault: true,
    allowedMimeTypes: MIME_TYPES,
    maxSizeBytes: 2 * MB,
    sortOrder: 1,
  },
  {
    buildingCode: "G1",
    code: "KTM",
    name: "Kartu Tanda Mahasiswa",
    isRequiredByDefault: true,
    allowedMimeTypes: MIME_TYPES,
    maxSizeBytes: 2 * MB,
    sortOrder: 2,
  },
  {
    buildingCode: "G2",
    code: "KTP",
    name: "KTP",
    isRequiredByDefault: true,
    allowedMimeTypes: MIME_TYPES,
    maxSizeBytes: 2 * MB,
    sortOrder: 1,
  },
  {
    buildingCode: "G2",
    code: "KTM",
    name: "Kartu Tanda Mahasiswa",
    isRequiredByDefault: true,
    allowedMimeTypes: MIME_TYPES,
    maxSizeBytes: 2 * MB,
    sortOrder: 2,
  },
];

export async function seedDocumentTypes(buildingIds: Map<string, string>) {
  let count = 0;

  for (const type of DOCUMENT_TYPES) {
    const buildingId = requireId(buildingIds, type.buildingCode, "building");
    const data = {
      name: type.name,
      isRequiredByDefault: type.isRequiredByDefault,
      isActive: true,
      allowedMimeTypes: type.allowedMimeTypes,
      maxSizeBytes: type.maxSizeBytes,
      sortOrder: type.sortOrder,
      deletedAt: null,
    };

    await syncSoftRecord({
      findActive: () =>
        prisma.documentType.findFirst({
          where: { buildingId, code: type.code, deletedAt: null },
        }),
      findAny: () =>
        prisma.documentType.findFirst({
          where: { buildingId, code: type.code },
          orderBy: { createdAt: "asc" },
        }),
      create: () =>
        prisma.documentType.create({ data: { buildingId, code: type.code, ...data } }),
      update: (id) => prisma.documentType.update({ where: { id }, data }),
    });
    count++;
  }

  logSeeded("document types", count);
  return count;
}
