-- Written to be safe to re-run (see 20260905130000_multi_cabang_dan_akun).

-- AlterTable
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "brand" TEXT;
