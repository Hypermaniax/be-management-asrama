import { prisma } from "../../src/lib/prisma.ts";

export type DocumentTypeSeed = {
  buildingCode: string;
  code: string;
  name: string;
  isRequiredByDefault: boolean;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  sortOrder: number;
};

const MB = 1024 * 1024;

export const DOCUMENT_TYPES: DocumentTypeSeed[] = [
  {
    buildingCode: "G1",
    code: "KTP",
    name: "KTP",
    isRequiredByDefault: true,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSizeBytes: 2 * MB,
    sortOrder: 1,
  },
  {
    buildingCode: "G1",
    code: "KTM",
    name: "Kartu Tanda Mahasiswa",
    isRequiredByDefault: true,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSizeBytes: 2 * MB,
    sortOrder: 2,
  },
  {
    buildingCode: "G2",
    code: "KTP",
    name: "KTP",
    isRequiredByDefault: true,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSizeBytes: 2 * MB,
    sortOrder: 1,
  },
  {
    buildingCode: "G2",
    code: "KTM",
    name: "Kartu Tanda Mahasiswa",
    isRequiredByDefault: true,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSizeBytes: 2 * MB,
    sortOrder: 2,
  },
];

export async function seedDocumentTypes(buildingIds: Map<string, string>) {
  let count = 0;

  for (const type of DOCUMENT_TYPES) {
    const buildingId = buildingIds.get(type.buildingCode);
    if (!buildingId) continue;

    const existing = await prisma.documentType.findFirst({
      where: { buildingId, code: type.code, deletedAt: null },
    });

    const data = {
      name: type.name,
      isRequiredByDefault: type.isRequiredByDefault,
      allowedMimeTypes: type.allowedMimeTypes,
      maxSizeBytes: type.maxSizeBytes,
      sortOrder: type.sortOrder,
    };

    if (existing) {
      await prisma.documentType.update({ where: { id: existing.id }, data });
    } else {
      await prisma.documentType.create({ data: { buildingId, code: type.code, ...data } });
    }
    count++;
  }

  console.log(`seeded ${count} document types`);
  return count;
}
