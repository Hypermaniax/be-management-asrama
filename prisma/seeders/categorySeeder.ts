import { prisma } from "../../src/lib/prisma.ts";
import type { CategoryKind } from "../../src/generated/prisma/client.ts";

export type CategorySeed = { name: string; kind: CategoryKind };

export const CATEGORIES: CategorySeed[] = [
  { name: "Iuran", kind: "INCOME" },
  { name: "Bantuan Pemerintah", kind: "INCOME" },
  { name: "Donasi", kind: "INCOME" },
  { name: "Listrik", kind: "EXPENSE" },
  { name: "Air", kind: "EXPENSE" },
  { name: "Perbaikan", kind: "EXPENSE" },
  { name: "Konsumsi", kind: "EXPENSE" },
  { name: "Transport", kind: "EXPENSE" },
  { name: "ATK", kind: "EXPENSE" },
  { name: "Kebersihan", kind: "EXPENSE" },
];

export async function seedCategories(buildingIds: Map<string, string>) {
  let count = 0;

  for (const buildingId of buildingIds.values()) {
    for (const category of CATEGORIES) {
      const existing = await prisma.category.findFirst({
        where: { buildingId, name: category.name, deletedAt: null },
      });

      if (existing) {
        await prisma.category.update({
          where: { id: existing.id },
          data: { kind: category.kind },
        });
      } else {
        await prisma.category.create({
          data: { buildingId, name: category.name, kind: category.kind },
        });
      }
      count++;
    }
  }

  console.log(`seeded ${count} categories`);
  return count;
}
