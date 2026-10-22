import type { Gender } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded } from "./utils.ts";

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
    const row = await prisma.building.upsert({
      where: { code: building.code },
      create: { ...building, isActive: true },
      update: { ...building, isActive: true, deletedAt: null },
    });
    idByCode.set(building.code, row.id);
  }

  logSeeded("buildings", idByCode.size);
  return idByCode;
}
