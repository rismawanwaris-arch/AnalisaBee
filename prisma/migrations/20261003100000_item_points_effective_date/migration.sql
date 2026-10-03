-- AlterTable
ALTER TABLE "item_points" ADD COLUMN IF NOT EXISTS "startDate" DATE NOT NULL DEFAULT '2020-01-01';

-- DropIndex
DROP INDEX IF EXISTS "item_points_pattern_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "item_points_pattern_startDate_key" ON "item_points"("pattern", "startDate");
CREATE INDEX IF NOT EXISTS "item_points_pattern_idx" ON "item_points"("pattern");
CREATE INDEX IF NOT EXISTS "item_points_startDate_idx" ON "item_points"("startDate");
