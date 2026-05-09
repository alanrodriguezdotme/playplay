-- AlterTable
ALTER TABLE "Song" ADD COLUMN "isFallbackOnly" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing default-playlist songs become fallback-only
UPDATE "Song" SET "isFallbackOnly" = 1 WHERE "isDefault" = 1;
