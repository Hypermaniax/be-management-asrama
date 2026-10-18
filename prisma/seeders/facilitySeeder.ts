import type {
  FacilityCategory,
  FacilityScope,
  FacilityUsage,
} from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";

export type FacilitySeed = {
  code: string;
  name: string;
  scope: FacilityScope;
  usageMode: FacilityUsage;
  category: FacilityCategory;
};

export const FACILITIES: FacilitySeed[] = [
  { code: "MEJA", name: "Meja", scope: "ROOM", usageMode: "SHARED", category: "FURNITURE" },
  { code: "KASUR", name: "Kasur", scope: "ROOM", usageMode: "SHARED", category: "FURNITURE" },
  { code: "LEMARI", name: "Lemari", scope: "ROOM", usageMode: "SHARED", category: "FURNITURE" },
  { code: "KM", name: "Kamar Mandi", scope: "PUBLIC", usageMode: "ASSIGNED", category: "SANITARY" },
  { code: "PARKIR", name: "Parkir", scope: "PUBLIC", usageMode: "SHARED", category: "OTHER" },
  { code: "DAPUR", name: "Dapur", scope: "PUBLIC", usageMode: "SHARED", category: "OTHER" },
  { code: "OLAHRAGA", name: "Area Olahraga", scope: "PUBLIC", usageMode: "SHARED", category: "OTHER" },
];

export async function seedFacilities() {
  const idByCode = new Map<string, string>();

  for (const facility of FACILITIES) {
    const created = await prisma.facility.upsert({
      where: { code: facility.code },
      create: facility,
      update: {
        name: facility.name,
        scope: facility.scope,
        usageMode: facility.usageMode,
        category: facility.category,
      },
    });
    idByCode.set(facility.code, created.id);
  }

  console.log(`seeded ${idByCode.size} facilities`);
  return idByCode;
}
