-- CreateEnum
CREATE TYPE "TargetScope" AS ENUM ('PERKONTER', 'ALL');

-- CreateEnum
CREATE TYPE "BusinessLine" AS ENUM ('SERVER', 'TARTUN', 'PETSHOP', 'AKSESORIS', 'SP_VOUCHER');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('PETSHOP', 'AKSESORIS', 'SP_VOUCHER');

-- CreateTable
CREATE TABLE "targets" (
    "id" SERIAL NOT NULL,
    "scope" "TargetScope" NOT NULL,
    "category" "BusinessLine" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_aliases" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_group_mappings" (
    "id" SERIAL NOT NULL,
    "itemGroup" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_group_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tartun_daily" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "outletId" INTEGER NOT NULL,
    "sales" DECIMAL(14,2) NOT NULL,
    "trx" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tartun_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_daily" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "outletId" INTEGER NOT NULL,
    "sales" DECIMAL(14,2) NOT NULL,
    "trx" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "targets_scope_category_key" ON "targets"("scope", "category");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_aliases_alias_key" ON "outlet_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "item_group_mappings_itemGroup_key" ON "item_group_mappings"("itemGroup");

-- CreateIndex
CREATE INDEX "tartun_daily_tanggal_idx" ON "tartun_daily"("tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "tartun_daily_tanggal_outletId_key" ON "tartun_daily"("tanggal", "outletId");

-- CreateIndex
CREATE INDEX "server_daily_tanggal_idx" ON "server_daily"("tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "server_daily_tanggal_outletId_key" ON "server_daily"("tanggal", "outletId");

-- AddForeignKey
ALTER TABLE "outlet_aliases" ADD CONSTRAINT "outlet_aliases_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tartun_daily" ADD CONSTRAINT "tartun_daily_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_daily" ADD CONSTRAINT "server_daily_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
