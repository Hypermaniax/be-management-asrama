-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "decreeNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "buildingId" TEXT,
    "roleId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAssignment" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "decreeNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PositionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Period_code_key" ON "Period"("code");

-- CreateIndex
CREATE INDEX "Period_deletedAt_idx" ON "Period"("deletedAt");

-- CreateIndex
CREATE INDEX "Position_buildingId_idx" ON "Position"("buildingId");

-- CreateIndex
CREATE INDEX "Position_deletedAt_idx" ON "Position"("deletedAt");

-- CreateIndex
CREATE INDEX "PositionAssignment_userId_idx" ON "PositionAssignment"("userId");

-- CreateIndex
CREATE INDEX "PositionAssignment_buildingId_idx" ON "PositionAssignment"("buildingId");

-- CreateIndex
CREATE INDEX "PositionAssignment_deletedAt_idx" ON "PositionAssignment"("deletedAt");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique: kode jabatan unik per scope gedung (asrama-wide = ''), hanya baris aktif
CREATE UNIQUE INDEX "Position_scope_code_active_key" ON "Position"(COALESCE("buildingId", ''), "code") WHERE "deletedAt" IS NULL;

-- Partial unique: satu penugasan aktif per (periode, jabatan, user)
CREATE UNIQUE INDEX "PositionAssignment_active_key" ON "PositionAssignment"("periodId", "positionId", "userId") WHERE "deletedAt" IS NULL;
