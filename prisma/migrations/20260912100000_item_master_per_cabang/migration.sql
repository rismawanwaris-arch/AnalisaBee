-- Written to be safe to re-run (see 20260905130000_multi_cabang_dan_akun).
--
-- Item.code was globally unique, but Bandung and Cimahi run independent POS
-- catalogs that happen to reuse the same numeric codes for unrelated
-- products. Scoping uniqueness to (code, branch) lets both branches keep
-- their own item definitions without colliding.

-- AlterTable
ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "branch" "Branch" NOT NULL DEFAULT 'BANDUNG',
  ADD COLUMN IF NOT EXISTS "isFromSalesImport" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX IF EXISTS "items_code_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "items_code_branch_key" ON "items"("code", "branch");
