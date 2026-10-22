import { prisma } from "../src/lib/prisma.ts";
import { seedBuildings } from "./seeders/buildingSeeder.ts";
import { seedCashAccounts } from "./seeders/cashAccountSeeder.ts";
import { seedCategories } from "./seeders/categorySeeder.ts";
import { seedDemoUsers } from "./seeders/demoUserSeeder.ts";
import { seedDocumentTypes } from "./seeders/documentTypeSeeder.ts";
import { seedFacilities } from "./seeders/facilitySeeder.ts";
import { seedFeeRules } from "./seeders/feeRuleSeeder.ts";
import { seedMenus } from "./seeders/menuSeeder.ts";
import { seedPermissions } from "./seeders/permissionSeeder.ts";
import { seedPositions } from "./seeders/positionSeeder.ts";
import { seedRoles } from "./seeders/roleSeeder.ts";
import { seedRooms } from "./seeders/roomSeeder.ts";
import { seedUsers } from "./seeders/userSeeder.ts";

async function main() {
  console.log("\nSeeding database…");

  const menuIds = await seedMenus();
  const permissionIds = await seedPermissions();
  const roleIds = await seedRoles({ menuIds, permissionIds });
  const buildingIds = await seedBuildings();
  const roomCount = await seedRooms(buildingIds);
  const feeRuleCount = await seedFeeRules(buildingIds);
  const facilityCount = (await seedFacilities()).size;
  const documentTypeCount = await seedDocumentTypes(buildingIds);
  const cashAccountCount = await seedCashAccounts(buildingIds);
  const categoryCount = await seedCategories(buildingIds);
  const positionCount = await seedPositions(buildingIds, roleIds);
  await seedUsers({ roleIds });
  await seedDemoUsers({ roleIds, buildingIds });

  console.log(
    [
      "\nSeed selesai —",
      `roles: ${roleIds.size}`,
      `menus: ${menuIds.size}`,
      `permissions: ${permissionIds.size}`,
      `buildings: ${buildingIds.size}`,
      `rooms: ${roomCount}`,
      `feeRules: ${feeRuleCount}`,
      `facilities: ${facilityCount}`,
      `documentTypes: ${documentTypeCount}`,
      `cashAccounts: ${cashAccountCount}`,
      `categories: ${categoryCount}`,
      `positions: ${positionCount}`,
    ].join(" "),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
