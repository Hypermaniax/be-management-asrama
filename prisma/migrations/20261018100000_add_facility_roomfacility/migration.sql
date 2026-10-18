-- CreateEnum
CREATE TYPE "FacilityScope" AS ENUM ('ROOM', 'PUBLIC');

-- CreateEnum
CREATE TYPE "FacilityUsage" AS ENUM ('ASSIGNED', 'SHARED');

-- CreateEnum
CREATE TYPE "FacilityCategory" AS ENUM ('FURNITURE', 'SANITARY', 'APPLIANCE', 'OTHER');

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "FacilityScope" NOT NULL,
    "usageMode" "FacilityUsage" NOT NULL,
    "category" "FacilityCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomFacility" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RoomFacility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Facility_code_key" ON "Facility"("code");

-- CreateIndex
CREATE INDEX "Facility_deletedAt_idx" ON "Facility"("deletedAt");

-- CreateIndex
CREATE INDEX "RoomFacility_roomId_idx" ON "RoomFacility"("roomId");

-- CreateIndex
CREATE INDEX "RoomFacility_facilityId_idx" ON "RoomFacility"("facilityId");

-- CreateIndex
CREATE INDEX "RoomFacility_deletedAt_idx" ON "RoomFacility"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomFacility_roomId_facilityId_key" ON "RoomFacility"("roomId", "facilityId");

-- AddForeignKey
ALTER TABLE "RoomFacility" ADD CONSTRAINT "RoomFacility_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomFacility" ADD CONSTRAINT "RoomFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
