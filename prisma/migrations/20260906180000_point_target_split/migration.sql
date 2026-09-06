-- AlterTable
-- Splits the single "pointTarget" point-settings value into three
-- independently configurable targets, one per period mode (Harian /
-- Mingguan / Bulanan) on the public points wallboard. The pre-existing
-- "pointTarget" column is kept as-is and now maps to pointTargetMonthly
-- via Prisma's @map (see prisma/schema.prisma) — no rename/data migration
-- needed for that one.
ALTER TABLE "point_settings" ADD COLUMN IF NOT EXISTS "pointTargetWeekly" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "point_settings" ADD COLUMN IF NOT EXISTS "pointTargetDaily" INTEGER NOT NULL DEFAULT 0;
