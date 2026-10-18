-- CreateTable
CREATE TABLE "FeeRule" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "dueDayOfMonth" INTEGER NOT NULL,
    "defaultMonthlyRate" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeRule_buildingId_effectiveFrom_idx" ON "FeeRule"("buildingId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "FeeRule" ADD CONSTRAINT "FeeRule_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
