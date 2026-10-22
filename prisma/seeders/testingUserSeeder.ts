import type { Gender } from "../../src/generated/prisma/client.ts";
import { hashPassword } from "../../src/lib/password.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { DEMO_PASSWORD } from "./demoUserSeeder.ts";
import { ensureUserRole, logSeeded, requireId, syncSoftRecord } from "./utils.ts";

const OCCUPANCY_START = new Date("2025-08-01");

export type TestingAdmin = {
  email: string;
  name: string;
  buildingCode: string;
};

export type TestingWarga = {
  email: string;
  name: string;
  gender: Gender;
  buildingCode: string;
  roomNumber: string;
  bedLabel: string;
};

export type TestingCalon = {
  email: string;
  name: string;
  gender: Gender;
};

export const TESTING_ADMINS: TestingAdmin[] = [
  { email: "gedung1@gmail.com", name: "Admin Gedung Putra", buildingCode: "G1" },
  { email: "gedung2@gmail.com", name: "Admin Gedung Putri", buildingCode: "G2" },
];

export const TESTING_WARGA: TestingWarga[] = [
  { email: "warga1@gmail.com", name: "Raka", gender: "MALE", buildingCode: "G1", roomNumber: "101", bedLabel: "A" },
  { email: "warga2@gmail.com", name: "Bima", gender: "MALE", buildingCode: "G1", roomNumber: "101", bedLabel: "C" },
  { email: "warga3@gmail.com", name: "Adit", gender: "MALE", buildingCode: "G1", roomNumber: "102", bedLabel: "A" },
  { email: "warga4@gmail.com", name: "Sari", gender: "FEMALE", buildingCode: "G2", roomNumber: "201", bedLabel: "A" },
  { email: "warga5@gmail.com", name: "Nadia", gender: "FEMALE", buildingCode: "G2", roomNumber: "201", bedLabel: "B" },
];

export const TESTING_CALON: TestingCalon[] = [
  { email: "calon2@gmail.com", name: "Fajar", gender: "MALE" },
];

type EmailName = { email: string; name: string };

async function upsertDemoUsers(
  users: EmailName[],
  data: (user: EmailName) => Record<string, unknown>,
) {
  const hashed = await hashPassword(DEMO_PASSWORD);
  const idByEmail = new Map<string, string>();
  for (const user of users) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        password: hashed,
        name: user.name,
        ...data(user),
      },
      update: {
        password: hashed,
        name: user.name,
        ...data(user),
        deletedAt: null,
      },
    });
    idByEmail.set(user.email, row.id);
  }
  return idByEmail;
}

const activeMonthlyRate = async (buildingId: string) => {
  const rule = await prisma.feeRule.findFirst({
    where: { buildingId, deletedAt: null },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rule) {
    throw new Error("seed: FeeRule gedung belum ada — jalankan seed dasar dulu");
  }
  return rule.defaultMonthlyRate;
};

export async function seedTestingUsersAndPlacement() {
  const buildingIds = new Map<string, string>();
  for (const building of await prisma.building.findMany({ where: { deletedAt: null } })) {
    buildingIds.set(building.code, building.id);
  }
  const roleIds = new Map<string, string>();
  for (const role of await prisma.role.findMany({ where: { deletedAt: null } })) {
    roleIds.set(role.code, role.id);
  }

  const adminIds = await upsertDemoUsers(TESTING_ADMINS, () => ({
    emailVerified: true,
    status: "ACTIVE",
    gender: null,
  }));
  const wargaIds = await upsertDemoUsers(TESTING_WARGA, (warga) => ({
    emailVerified: true,
    status: "ACTIVE",
    gender: (warga as TestingWarga).gender,
  }));
  const calonIds = await upsertDemoUsers(TESTING_CALON, (calon) => ({
    emailVerified: true,
    status: "PENDING",
    gender: (calon as TestingCalon).gender,
  }));

  // Admin gedung: ADMIN_GEDUNG ber-scope gedungnya
  for (const admin of TESTING_ADMINS) {
    await ensureUserRole(
      adminIds.get(admin.email) as string,
      requireId(roleIds, "ADMIN_GEDUNG", "role"),
      requireId(buildingIds, admin.buildingCode, "building"),
    );
  }
  logSeeded("admin gedung testing (G1 & G2)", TESTING_ADMINS.length);

  // Warga: PENGHUNI + penempatan kamar (snapshot tarif dari FeeRule aktif)
  for (const warga of TESTING_WARGA) {
    const userId = wargaIds.get(warga.email) as string;
    await ensureUserRole(userId, requireId(roleIds, "PENGHUNI", "role"), null);

    const buildingId = requireId(buildingIds, warga.buildingCode, "building");
    const room = await prisma.room.findFirst({
      where: { buildingId, number: warga.roomNumber, deletedAt: null },
    });
    if (!room) {
      throw new Error(
        `seed: kamar ${warga.roomNumber} gedung ${warga.buildingCode} tidak ada — jalankan seed dasar dulu`,
      );
    }

    const occupancyData = {
      roomId: room.id,
      bedLabel: warga.bedLabel,
      monthlyRateSnapshot: await activeMonthlyRate(buildingId),
      startDate: OCCUPANCY_START,
      status: "ACTIVE" as const,
      deletedAt: null,
    };
    await syncSoftRecord({
      findActive: () =>
        prisma.occupancy.findFirst({ where: { userId, status: "ACTIVE", deletedAt: null } }),
      findAny: () =>
        prisma.occupancy.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
      create: () => prisma.occupancy.create({ data: { userId, ...occupancyData } }),
      update: (id) => prisma.occupancy.update({ where: { id }, data: occupancyData }),
    });
  }
  logSeeded("warga testing + penempatan", TESTING_WARGA.length);

  // Calon: CALON_PENGHUNI, status PENDING (untuk uji review pendaftaran)
  for (const calon of TESTING_CALON) {
    await ensureUserRole(
      calonIds.get(calon.email) as string,
      requireId(roleIds, "CALON_PENGHUNI", "role"),
      null,
    );
  }
  logSeeded("calon testing (PENDING)", TESTING_CALON.length);

  return { adminIds, wargaIds, buildingIds };
}
