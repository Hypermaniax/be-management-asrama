/*
  Warnings:

  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Venue` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Venue" DROP CONSTRAINT "Venue_ownerId_fkey";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Venue";

-- DropEnum
DROP TYPE "PriceUnit";

-- DropEnum
DROP TYPE "VenueStatus";
