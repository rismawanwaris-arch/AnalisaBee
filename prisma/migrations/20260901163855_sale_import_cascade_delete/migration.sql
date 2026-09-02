-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_importId_fkey";

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_importId_fkey" FOREIGN KEY ("importId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
