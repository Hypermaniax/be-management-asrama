import type { Gender } from "../../src/generated/prisma/client.ts";
import { hashPassword } from "../../src/lib/password.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ensureUserRole, logSeeded, requireId } from "./utils.ts";

export const DEMO_PASSWORD = "Sewdaq123";

type DemoUser = {
  email: string;
  name: string;
  role: string;
  gender?: Gender;
  buildingCode?: string;
};

export const DEMO_USERS: DemoUser[] = [
  { email: "admin@gmail.com", name: "Admin Master", role: "SUPER_ADMIN" },
  {
    email: "gedung@gmail.com",
    name: "Admin Gedung",
    role: "ADMIN_GEDUNG",
    buildingCode: "G1",
  },
  {
    email: "bendahara@gmail.com",
    name: "Bendahara",
    role: "BENDAHARA",
    buildingCode: "G1",
  },
  {
    email: "pengurus@gmail.com",
    name: "Pengurus",
    role: "PENGURUS",
    buildingCode: "G1",
  },
  { email: "warga@gmail.com", name: "Warga", role: "PENGHUNI", gender: "MALE" },
  {
    email: "calon@gmail.com",
    name: "Calon Penghuni",
    role: "CALON_PENGHUNI",
    gender: "FEMALE",
  },
];

type SeedDemoUsersInput = {
  roleIds: Map<string, string>;
  buildingIds: Map<string, string>;
};

export async function seedDemoUsers({ roleIds, buildingIds }: SeedDemoUsersInput) {
  if (process.env.NODE_ENV === "production") {
    console.log("  – demo users: dilewati di production");
    return;
  }

  const hashed = await hashPassword(DEMO_PASSWORD);

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        password: hashed,
        name: demo.name,
        gender: demo.gender ?? null,
        emailVerified: true,
        status: "ACTIVE",
      },
      update: {
        password: hashed,
        name: demo.name,
        gender: demo.gender ?? null,
        emailVerified: true,
        status: "ACTIVE",
        deletedAt: null,
      },
    });

    const roleId = requireId(roleIds, demo.role, "role");
    const buildingId = demo.buildingCode
      ? requireId(buildingIds, demo.buildingCode, "building")
      : null;

    await ensureUserRole(user.id, roleId, buildingId);
  }

  logSeeded("demo users", DEMO_USERS.length);
}
