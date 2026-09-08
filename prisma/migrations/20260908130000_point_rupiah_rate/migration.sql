-- AlterTable
-- Rupiah value of 1 point, for the incentive column on the internal "Poin
-- Penjualan" page (admin-only, never on the public Papan Poin wallboard).
ALTER TABLE "point_settings" ADD COLUMN IF NOT EXISTS "pointRupiahRate" INTEGER NOT NULL DEFAULT 100;
