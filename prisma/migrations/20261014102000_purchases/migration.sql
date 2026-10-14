-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_batches" (
    "id" SERIAL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorRowCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_invoices" (
    "id" SERIAL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "refInvoice" TEXT,
    "outletName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'Rupiah',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "batchId" INTEGER
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_items" (
    "id" SERIAL PRIMARY KEY,
    "invoiceId" INTEGER NOT NULL,
    "itemSeq" INTEGER,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoices_invoiceNumber_key" ON "purchase_invoices"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "purchase_invoices_date_idx" ON "purchase_invoices"("date");
CREATE INDEX IF NOT EXISTS "purchase_invoices_vendor_idx" ON "purchase_invoices"("vendor");
CREATE INDEX IF NOT EXISTS "purchase_invoices_outletName_idx" ON "purchase_invoices"("outletName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_items_invoiceId_idx" ON "purchase_items"("invoiceId");
CREATE INDEX IF NOT EXISTS "purchase_items_itemCode_idx" ON "purchase_items"("itemCode");
CREATE INDEX IF NOT EXISTS "purchase_items_itemName_idx" ON "purchase_items"("itemName");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "purchase_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
