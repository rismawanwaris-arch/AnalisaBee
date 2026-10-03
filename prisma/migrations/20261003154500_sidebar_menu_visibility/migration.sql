-- AlterTable
ALTER TABLE "point_settings" ADD COLUMN IF NOT EXISTS "hiddenMenuItems" TEXT[] NOT NULL DEFAULT '{}';
