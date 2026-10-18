import type { Gender } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";

export type BuildingSeed = {
  code: string;
  name: string;
  gender: Gender;
  address: string;
};

export const BUILDINGS: BuildingSeed[] = [
  { code: "G1", name: "Gedung Putra", gender: "MALE", address: "Yogyakarta" },
  { code: "G2", name: "Gedung Putri", gender: "FEMALE", address: "Yogyakarta" },
];

export async function seedBuildings() {
  const idByCode = new Map<string, string>();

  for (const building of BUILDINGS) {
    const created = await prisma.building.upsert({
      where: { code: building.code },
      create: building,
      update: {
        name: building.name,
        gender: building.gender,
        address: building.address,
      },
    });
    idByCode.set(building.code, created.id);
  }

  console.log(`seeded ${idByCode.size} buildings`);
  return idByCode;
}
