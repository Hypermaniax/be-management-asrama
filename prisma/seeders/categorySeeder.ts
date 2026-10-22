import type { CategoryKind } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded, syncSoftRecord } from "./utils.ts";

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
      const data = { kind: category.kind, deletedAt: null };

      await syncSoftRecord({
        findActive: () =>
          prisma.category.findFirst({
            where: { buildingId, name: category.name, deletedAt: null },
          }),
        findAny: () =>
          prisma.category.findFirst({
            where: { buildingId, name: category.name },
            orderBy: { createdAt: "asc" },
          }),
        create: () =>
          prisma.category.create({
            data: { buildingId, name: category.name, ...data },
          }),
        update: (id) => prisma.category.update({ where: { id }, data }),
      });
      count++;
    }
  }

  logSeeded("categories", count);
  return count;
}
