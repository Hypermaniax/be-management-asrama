-- CreateTable + add enum type (perbaikan dari 20261022120000 yang membuat kolom effect sebagai TEXT)
CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'DENY');

ALTER TABLE "UserPermissionOverride" ALTER COLUMN "effect" TYPE "PermissionEffect" USING "effect"::text::"PermissionEffect";
