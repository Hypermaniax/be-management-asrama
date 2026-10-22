import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded, requireId, syncSoftRecord } from "./utils.ts";

const PERIOD = {
  code: "2026-2027",
  name: "Kepengurusan 2026/2027",
  startDate: new Date("2026-09-01"),
  endDate: new Date("2027-08-31"),
  decreeNumber: "SK-01/KPR/IX/2026",
};

const ASSIGNMENT_START = new Date("2026-09-01");

export type StructureAssignment = {
  /** Kode jabatan; untuk jabatan per gedung sertakan juga buildingCode */
  positionCode: string;
  buildingCode?: string;
  /** Email user yang duduk di jabatan itu */
  userEmail: string;
};

export const STRUCTURE_ASSIGNMENTS: StructureAssignment[] = [
  { positionCode: "KETUA", userEmail: "warga3@gmail.com" },
  { positionCode: "WAKIL_KETUA", userEmail: "warga4@gmail.com" },
  { positionCode: "SEKRETARIS", userEmail: "warga1@gmail.com" },
  { positionCode: "BENDAHARA", userEmail: "warga2@gmail.com" },
  { positionCode: "KOOR_GEDUNG", buildingCode: "G1", userEmail: "warga@gmail.com" },
  { positionCode: "KOOR_GEDUNG", buildingCode: "G2", userEmail: "warga5@gmail.com" },
];

export async function seedTestingStructure({
  buildingIds,
}: {
  buildingIds: Map<string, string>;
}) {
  // Hanya 1 periode aktif — tutup periode aktif lain sebelum mengaktifkan
  const period = await prisma.period.upsert({
    where: { code: PERIOD.code },
    create: { ...PERIOD, isActive: true },
    update: { ...PERIOD, isActive: true, deletedAt: null },
  });
  await prisma.period.updateMany({
    where: { isActive: true, id: { not: period.id } },
    data: { isActive: false },
  });

  const positions = await prisma.position.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, code: true, buildingId: true },
  });
  const positionByKey = new Map(
    positions.map((position) => [`${position.code}|${position.buildingId ?? ""}`, position.id]),
  );

  const positionAssignments: { positionId: string; userId: string; buildingId: string | null }[] = [];
  for (const assignment of STRUCTURE_ASSIGNMENTS) {
    const buildingId = assignment.buildingCode
      ? requireId(buildingIds, assignment.buildingCode, "building")
      : null;
    const positionId = positionByKey.get(`${assignment.positionCode}|${buildingId ?? ""}`);
    if (!positionId) {
      throw new Error(
        `seed: jabatan ${assignment.positionCode}${buildingId ? ` (gedung ${assignment.buildingCode})` : ""} tidak ada — jalankan seed dasar dulu`,
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: assignment.userEmail, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`seed: user ${assignment.userEmail} tidak ada — jalankan seed dasar dulu`);
    }

    positionAssignments.push({ positionId, userId: user.id, buildingId });
  }

  let count = 0;
  for (const assignmentData of positionAssignments) {
    const data = {
      buildingId: assignmentData.buildingId,
      startDate: ASSIGNMENT_START,
      isActive: true,
      deletedAt: null,
    };
    await syncSoftRecord({
      findActive: () =>
        prisma.positionAssignment.findFirst({
          where: {
            periodId: period.id,
            positionId: assignmentData.positionId,
            userId: assignmentData.userId,
            deletedAt: null,
          },
        }),
      findAny: () =>
        prisma.positionAssignment.findFirst({
          where: {
            periodId: period.id,
            positionId: assignmentData.positionId,
            userId: assignmentData.userId,
          },
          orderBy: { createdAt: "asc" },
        }),
      create: () =>
        prisma.positionAssignment.create({
          data: {
            periodId: period.id,
            positionId: assignmentData.positionId,
            userId: assignmentData.userId,
            ...data,
          },
        }),
      update: (id) => prisma.positionAssignment.update({ where: { id }, data }),
    });
    count++;
  }

  logSeeded(`struktur kepengurusan ${period.code} (penugasan)`, count);

  return { period };
}
