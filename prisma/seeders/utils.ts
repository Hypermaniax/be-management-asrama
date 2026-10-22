import { prisma } from "../../src/lib/prisma.ts";

export const MB = 1024 * 1024;

export function requireId(map: Map<string, string>, key: string, label: string): string {
  const id = map.get(key);
  if (!id) {
    throw new Error(`seed: ${label} "${key}" tidak ditemukan — periksa urutan seeder`);
  }
  return id;
}

export function logSeeded(label: string, count: number) {
  console.log(`  ✓ ${label}: ${count}`);
}

type SoftRecord = { id: string };

type SyncSoftInput<T extends SoftRecord> = {
  findActive: () => Promise<T | null>;
  findAny: () => Promise<T | null>;
  create: () => Promise<T>;
  update: (id: string) => Promise<unknown>;
};

export async function syncSoftRecord<T extends SoftRecord>(input: SyncSoftInput<T>) {
  const record = (await input.findActive()) ?? (await input.findAny());
  if (record) {
    await input.update(record.id);
    return;
  }
  await input.create();
}

export async function ensureUserRole(userId: string, roleId: string, buildingId: string | null) {
  const rows = await prisma.userRole.findMany({
    where: { userId, roleId },
    orderBy: { createdAt: "asc" },
  });

  const keep = rows.find((row) => row.buildingId === buildingId) ?? rows[0];

  if (keep) {
    await prisma.userRole.update({
      where: { id: keep.id },
      data: { buildingId, deletedAt: null },
    });
  } else {
    await prisma.userRole.create({ data: { userId, roleId, buildingId } });
  }

  const keptId = keep?.id;
  if (keptId) {
    await prisma.userRole.updateMany({
      where: { userId, roleId, id: { not: keptId }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
