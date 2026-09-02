-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorRowCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemGroup" TEXT,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "noTransaksi" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jamBuat" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "hargaJual" DECIMAL(14,4) NOT NULL,
    "diskon" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,4) NOT NULL,
    "hpp" DECIMAL(14,4) NOT NULL,
    "labaRugi" DECIMAL(14,4) NOT NULL,
    "rowHash" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "importId" INTEGER NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outlets_name_key" ON "outlets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "items_name_idx" ON "items"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_name_key" ON "employees"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sales_rowHash_key" ON "sales"("rowHash");

-- CreateIndex
CREATE INDEX "sales_itemId_tanggal_idx" ON "sales"("itemId", "tanggal");

-- CreateIndex
CREATE INDEX "sales_outletId_tanggal_idx" ON "sales"("outletId", "tanggal");

-- CreateIndex
CREATE INDEX "sales_tanggal_idx" ON "sales"("tanggal");

-- CreateIndex
CREATE INDEX "sales_employeeId_tanggal_idx" ON "sales"("employeeId", "tanggal");

-- CreateIndex
CREATE INDEX "sales_noTransaksi_idx" ON "sales"("noTransaksi");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_importId_fkey" FOREIGN KEY ("importId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
