import { hashPassword } from "../../src/lib/password.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { ensureUserRole, logSeeded, requireId } from "./utils.ts";

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
    console.log("  – bootstrap admin: set SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD");
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
    update: {
      password: hashed,
      emailVerified: true,
      status: "ACTIVE",
      deletedAt: null,
    },
  });

  await ensureUserRole(user.id, requireId(roleIds, "SUPER_ADMIN", "role"), null);
  logSeeded(`bootstrap admin (${email})`, 1);
}
