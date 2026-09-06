-- AlterTable
ALTER TABLE "point_settings" ADD COLUMN IF NOT EXISTS "pointTarget" INTEGER NOT NULL DEFAULT 0;
