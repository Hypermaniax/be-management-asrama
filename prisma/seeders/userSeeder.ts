import { hashPassword } from "../../src/lib/password.ts";
import { prisma } from "../../src/lib/prisma.ts";

const DEV_EMAIL = "admin@kepri.local";
const DEV_PASSWORD = "admin12345";

type SeedUsersInput = {
  roleIds: Map<string, string>;
};

export async function seedUsers({ roleIds }: SeedUsersInput) {
  const isProduction = process.env.NODE_ENV === "production";

  const email = process.env.SEED_ADMIN_EMAIL ?? (isProduction ? undefined : DEV_EMAIL);
  const password = process.env.SEED_ADMIN_PASSWORD ?? (isProduction ? undefined : DEV_PASSWORD);

  if (!email || !password) {
    console.log("skipped userSeeder: set SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD");
    return;
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hashed,
      name: "Admin Master",
      emailVerified: true,
      status: "ACTIVE",
    },
    update: { password: hashed, emailVerified: true, status: "ACTIVE" },
  });

  const roleId = roleIds.get("SUPER_ADMIN");
  if (roleId) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId, deletedAt: null },
    });
    if (!existing) {
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    }
  }

  console.log(`seeded user ${email} (SUPER_ADMIN)`);
}
