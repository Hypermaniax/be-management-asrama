import { hashPassword } from "../../src/lib/password.ts";
import { prisma } from "../../src/lib/prisma.ts";

export const DEMO_PASSWORD = "Sewdaq123";

type DemoUser = {
  email: string;
  name: string;
  role: string;
};

export const DEMO_USERS: DemoUser[] = [
  { email: "admin@gmail.com", name: "Admin Master", role: "SUPER_ADMIN" },
  { email: "gedung@gmail.com", name: "Admin Gedung", role: "ADMIN_GEDUNG" },
  { email: "calon@gmail.com", name: "Calon Penghuni", role: "CALON_PENGHUNI" },
  { email: "warga@gmail.com", name: "Warga", role: "PENGHUNI" },
];

type SeedDemoUsersInput = {
  roleIds: Map<string, string>;
};

export async function seedDemoUsers({ roleIds }: SeedDemoUsersInput) {
  if (process.env.NODE_ENV === "production") {
    console.log("skipped demoUserSeeder: production");
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
        emailVerified: true,
        status: "ACTIVE",
      },
      update: { password: hashed, name: demo.name, emailVerified: true, status: "ACTIVE" },
    });

    const roleId = roleIds.get(demo.role);
    if (!roleId) {
      console.log(`skipped role ${demo.role} for ${demo.email}: role not found`);
      continue;
    }

    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId, deletedAt: null },
    });
    if (!existing) {
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    }

    console.log(`seeded demo user ${demo.email} (${demo.role})`);
  }
}
