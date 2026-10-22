import { prisma } from "../src/lib/prisma.ts";
import { seedTestingUsersAndPlacement } from "./seeders/testingUserSeeder.ts";
import { seedTestingStructure } from "./seeders/testingStructureSeeder.ts";

async function main() {
  console.log("\nSeeding data testing…");

  const { buildingIds } = await seedTestingUsersAndPlacement();
  await seedTestingStructure({ buildingIds });

  console.log("Seed testing selesai ✅");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
