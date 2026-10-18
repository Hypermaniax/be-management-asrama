import { prisma } from "../../src/lib/prisma.ts";

export type PositionSeed = {
  code: string;
  name: string;
  level: number;
  buildingCode?: string;
  roleCode?: string;
};

export const POSITIONS: PositionSeed[] = [
  { code: "KETUA", name: "Ketua", level: 1 },
  { code: "WAKIL_KETUA", name: "Wakil Ketua", level: 2, roleCode: "PENGURUS" },
  { code: "SEKRETARIS", name: "Sekretaris", level: 2, roleCode: "PENGURUS" },
  { code: "BENDAHARA", name: "Bendahara", level: 2, roleCode: "BENDAHARA" },
  { code: "KOOR_ACARA", name: "Koordinator Acara/Humas", level: 3, roleCode: "PENGURUS" },
  { code: "KOOR_KEBERSIHAN", name: "Koordinator Kebersihan", level: 3, roleCode: "PENGURUS" },
  { code: "KOOR_PERLENGKAPAN", name: "Koordinator Perlengkapan", level: 3, roleCode: "PENGURUS" },
  { code: "KOOR_GEDUNG", name: "Koordinator Gedung", level: 3, buildingCode: "G1", roleCode: "PENGURUS" },
  { code: "KOOR_GEDUNG", name: "Koordinator Gedung", level: 3, buildingCode: "G2", roleCode: "PENGURUS" },
];

export async function seedPositions(
  buildingIds: Map<string, string>,
  roleIds: Map<string, string>,
) {
  let count = 0;

  for (const position of POSITIONS) {
    const buildingId = position.buildingCode
      ? (buildingIds.get(position.buildingCode) ?? null)
      : null;
    const roleId = position.roleCode ? (roleIds.get(position.roleCode) ?? null) : null;

    const existing = await prisma.position.findFirst({
      where: { code: position.code, buildingId, deletedAt: null },
    });

    const data = {
      name: position.name,
      level: position.level,
      buildingId,
      roleId,
      isActive: true,
    };

    if (existing) {
      await prisma.position.update({ where: { id: existing.id }, data });
    } else {
      await prisma.position.create({ data: { code: position.code, ...data } });
    }
    count++;
  }

  console.log(`seeded ${count} positions`);
  return count;
}
