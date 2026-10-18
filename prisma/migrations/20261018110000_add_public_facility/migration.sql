-- CreateEnum
CREATE TYPE "PublicFacStatus" AS ENUM ('ACTIVE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "PublicFacility" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "number" TEXT,
    "capacity" INTEGER,
    "status" "PublicFacStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PublicFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicFacilityAssignment" (
    "id" TEXT NOT NULL,
    "publicFacilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PublicFacilityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicFacility_buildingId_idx" ON "PublicFacility"("buildingId");

-- CreateIndex
CREATE INDEX "PublicFacility_facilityId_idx" ON "PublicFacility"("facilityId");

-- CreateIndex
CREATE INDEX "PublicFacility_deletedAt_idx" ON "PublicFacility"("deletedAt");

-- CreateIndex
CREATE INDEX "PublicFacilityAssignment_publicFacilityId_idx" ON "PublicFacilityAssignment"("publicFacilityId");

-- CreateIndex
CREATE INDEX "PublicFacilityAssignment_userId_idx" ON "PublicFacilityAssignment"("userId");

-- CreateIndex
CREATE INDEX "PublicFacilityAssignment_facilityId_idx" ON "PublicFacilityAssignment"("facilityId");

-- CreateIndex
CREATE INDEX "PublicFacilityAssignment_deletedAt_idx" ON "PublicFacilityAssignment"("deletedAt");

-- AddForeignKey
ALTER TABLE "PublicFacility" ADD CONSTRAINT "PublicFacility_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicFacility" ADD CONSTRAINT "PublicFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicFacilityAssignment" ADD CONSTRAINT "PublicFacilityAssignment_publicFacilityId_fkey" FOREIGN KEY ("publicFacilityId") REFERENCES "PublicFacility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicFacilityAssignment" ADD CONSTRAINT "PublicFacilityAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicFacilityAssignment" ADD CONSTRAINT "PublicFacilityAssignment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes (hanya baris aktif; Prisma tak mendukung partial unique)
CREATE UNIQUE INDEX "PublicFacility_building_facility_number_active_key"
  ON "PublicFacility"("buildingId", "facilityId", "number") WHERE "deletedAt" IS NULL AND "number" IS NOT NULL;
CREATE UNIQUE INDEX "PublicFacilityAssignment_facility_slot_active_key"
  ON "PublicFacilityAssignment"("publicFacilityId", "slotLabel") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "PublicFacilityAssignment_user_facility_active_key"
  ON "PublicFacilityAssignment"("userId", "facilityId") WHERE "deletedAt" IS NULL;
