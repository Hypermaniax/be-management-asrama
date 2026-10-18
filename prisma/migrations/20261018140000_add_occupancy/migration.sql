-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedLabel" TEXT,
    "monthlyRateSnapshot" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "OccupancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Occupancy_userId_idx" ON "Occupancy"("userId");

-- CreateIndex
CREATE INDEX "Occupancy_roomId_status_idx" ON "Occupancy"("roomId", "status");

-- CreateIndex
CREATE INDEX "Occupancy_deletedAt_idx" ON "Occupancy"("deletedAt");

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (partial unique: satu occupancy aktif per user)
CREATE UNIQUE INDEX "Occupancy_userId_active_key" ON "Occupancy"("userId") WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;
