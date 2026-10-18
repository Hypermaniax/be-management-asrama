-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CHECKOUT', 'INACTIVE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "buildingId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropDefault (updatedAt dikelola aplikasi via @updatedAt)
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Backfill: user yang sudah ada dianggap ACTIVE (bukan calon)
UPDATE "User" SET "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "User_buildingId_status_idx" ON "User"("buildingId", "status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique (nationalId unik hanya bila diisi & belum dihapus)
CREATE UNIQUE INDEX "User_nationalId_active_key"
  ON "User"("nationalId") WHERE "deletedAt" IS NULL AND "nationalId" IS NOT NULL;
