-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('RUTIN', 'BESAR');

-- CreateEnum
CREATE TYPE "EventScope" AS ENUM ('ASRAMA', 'GEDUNG');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'ONGOING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventRecurrence" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'IZIN', 'TIDAK');

-- CreateEnum
CREATE TYPE "EventAttachmentKind" AS ENUM ('PROPOSAL', 'NOTULEN', 'LPJ', 'FOTO', 'OTHER');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "EventCategory" NOT NULL,
    "isAdHoc" BOOLEAN NOT NULL DEFAULT false,
    "scope" "EventScope" NOT NULL,
    "buildingId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "budgetAmount" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'PLANNED',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" "EventRecurrence" NOT NULL DEFAULT 'NONE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCommittee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventRole" TEXT NOT NULL,
    "positionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventCommittee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'TIDAK',
    "checkedInAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttachment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" "EventAttachmentKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_buildingId_startAt_idx" ON "Event"("buildingId", "startAt");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_deletedAt_idx" ON "Event"("deletedAt");

-- CreateIndex
CREATE INDEX "EventSession_eventId_idx" ON "EventSession"("eventId");

-- CreateIndex
CREATE INDEX "EventSession_deletedAt_idx" ON "EventSession"("deletedAt");

-- CreateIndex
CREATE INDEX "EventCommittee_eventId_idx" ON "EventCommittee"("eventId");

-- CreateIndex
CREATE INDEX "EventCommittee_userId_idx" ON "EventCommittee"("userId");

-- CreateIndex
CREATE INDEX "EventCommittee_deletedAt_idx" ON "EventCommittee"("deletedAt");

-- CreateIndex
CREATE INDEX "EventAttendance_sessionId_idx" ON "EventAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "EventAttendance_userId_idx" ON "EventAttendance"("userId");

-- CreateIndex
CREATE INDEX "EventAttendance_deletedAt_idx" ON "EventAttendance"("deletedAt");

-- CreateIndex
CREATE INDEX "EventAttachment_eventId_idx" ON "EventAttachment"("eventId");

-- CreateIndex
CREATE INDEX "EventAttachment_deletedAt_idx" ON "EventAttachment"("deletedAt");

-- CreateIndex
CREATE INDEX "Expense_eventId_idx" ON "Expense"("eventId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommittee" ADD CONSTRAINT "EventCommittee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommittee" ADD CONSTRAINT "EventCommittee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommittee" ADD CONSTRAINT "EventCommittee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttachment" ADD CONSTRAINT "EventAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttachment" ADD CONSTRAINT "EventAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique: satu sesi per jadwal (boleh dibuat ulang setelah soft delete)
CREATE UNIQUE INDEX "EventSession_active_key" ON "EventSession"("eventId", "scheduledAt") WHERE "deletedAt" IS NULL;

-- Partial unique: satu panitia per user per event
CREATE UNIQUE INDEX "EventCommittee_active_key" ON "EventCommittee"("eventId", "userId") WHERE "deletedAt" IS NULL;

-- Partial unique: satu absensi per user per sesi
CREATE UNIQUE INDEX "EventAttendance_active_key" ON "EventAttendance"("sessionId", "userId") WHERE "deletedAt" IS NULL;
