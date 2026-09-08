-- Written to be safe to re-run (the ZimaOS deployment has had partially-applied
-- migrations before — see 20260905130000_multi_cabang_dan_akun).

-- AlterTable
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
