-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('REQUESTED', 'UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequiredByDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowedMimeTypes" TEXT[],
    "maxSizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'REQUESTED',
    "fileId" TEXT,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");

-- CreateIndex
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");

-- CreateIndex
CREATE INDEX "File_deletedAt_idx" ON "File"("deletedAt");

-- CreateIndex
CREATE INDEX "DocumentType_buildingId_idx" ON "DocumentType"("buildingId");

-- CreateIndex
CREATE INDEX "DocumentType_deletedAt_idx" ON "DocumentType"("deletedAt");

-- CreateIndex
CREATE INDEX "DocumentSubmission_userId_idx" ON "DocumentSubmission"("userId");

-- CreateIndex
CREATE INDEX "DocumentSubmission_documentTypeId_idx" ON "DocumentSubmission"("documentTypeId");

-- CreateIndex
CREATE INDEX "DocumentSubmission_deletedAt_idx" ON "DocumentSubmission"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSubmission_userId_documentTypeId_version_key" ON "DocumentSubmission"("userId", "documentTypeId", "version");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentType" ADD CONSTRAINT "DocumentType_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubmission" ADD CONSTRAINT "DocumentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubmission" ADD CONSTRAINT "DocumentSubmission_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubmission" ADD CONSTRAINT "DocumentSubmission_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubmission" ADD CONSTRAINT "DocumentSubmission_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubmission" ADD CONSTRAINT "DocumentSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique (DocumentType code unik per gedung, hanya baris aktif)
CREATE UNIQUE INDEX "DocumentType_buildingId_code_active_key"
  ON "DocumentType"("buildingId", "code") WHERE "deletedAt" IS NULL;
