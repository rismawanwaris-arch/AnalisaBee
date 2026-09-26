-- Written to be safe to re-run (see 20260905130000_multi_cabang_dan_akun).

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "isRetur" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "isRetur" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "returOfSaleId" INTEGER;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_returOfSaleId_fkey" FOREIGN KEY ("returOfSaleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
