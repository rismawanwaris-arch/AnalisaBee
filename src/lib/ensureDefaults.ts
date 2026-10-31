import { prisma } from "@/lib/prisma";
import { DEFAULT_ALIAS_MAP } from "@/lib/defaults/outletAliases";
import { DEFAULT_GROUP_MAP } from "@/lib/defaults/itemGroupMapping";
import { DEFAULT_TARGETS } from "@/lib/defaults/targets";
import { DEFAULT_GROUP_POINTS, DEFAULT_ITEM_POINTS } from "@/lib/defaults/itemPoints";

let _ensured = false;
let _ensuredCimahi = false;

export function invalidateDefaults() {
  _ensured = false;
  _ensuredCimahi = false;
}

export async function ensureDefaults(branch: "BANDUNG" | "CIMAHI" = "BANDUNG"): Promise<void> {
  if (branch === "CIMAHI") {
    if (_ensuredCimahi) return;
    _ensuredCimahi = true;
    await Promise.all(
      DEFAULT_TARGETS.map((t) =>
        prisma.target.upsert({
          where: { scope_category_branch: { scope: t.scope, category: t.category, branch: "CIMAHI" } },
          update: {},
          create: { scope: t.scope, category: t.category, branch: "CIMAHI", amount: t.amount },
        })
      )
    );
    return;
  }

  if (_ensured) return;
  _ensured = true;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "brand" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "isRetur" BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "isRetur" BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "returOfSaleId" INTEGER;`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_returOfSaleId_fkey" FOREIGN KEY ("returOfSaleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "item_points" ADD COLUMN IF NOT EXISTS "startDate" DATE NOT NULL DEFAULT '2020-01-01';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "item_points" DROP CONSTRAINT IF EXISTS "item_points_pattern_key";`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "item_points_pattern_startDate_key" ON "item_points"("pattern", "startDate");`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "point_settings" ADD COLUMN IF NOT EXISTS "hiddenMenuItems" TEXT[] NOT NULL DEFAULT '{}';`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "point_group_mappings" (
        "id" SERIAL PRIMARY KEY,
        "itemGroup" TEXT NOT NULL UNIQUE,
        "category" "ReportCategory" NOT NULL,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
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
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "purchase_invoices" (
        "id" SERIAL PRIMARY KEY,
        "invoiceNumber" TEXT NOT NULL UNIQUE,
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
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "purchase_items" (
        "id" SERIAL PRIMARY KEY,
        "invoiceId" INTEGER NOT NULL REFERENCES "purchase_invoices"("id") ON DELETE CASCADE,
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
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "purchase_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "purchase_invoices_date_idx" ON "purchase_invoices"("date");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "purchase_invoices_vendor_idx" ON "purchase_invoices"("vendor");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "purchase_invoices_outletName_idx" ON "purchase_invoices"("outletName");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "purchase_items_invoiceId_idx" ON "purchase_items"("invoiceId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "purchase_items_itemCode_idx" ON "purchase_items"("itemCode");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "purchase_items_itemName_idx" ON "purchase_items"("itemName");`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "unmatched_daily_metrics" (
        "id" SERIAL PRIMARY KEY,
        "kind" TEXT NOT NULL,
        "tanggal" DATE NOT NULL,
        "rawName" TEXT NOT NULL,
        "sales" DECIMAL(14,2) NOT NULL,
        "trx" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unmatched_daily_metrics_kind_tanggal_rawName_key"
        ON "unmatched_daily_metrics"("kind", "tanggal", "rawName");
    `);
  } catch {
    // ignore error if tables not yet created
  }

  await Promise.all(
    DEFAULT_TARGETS.map((t) =>
      prisma.target.upsert({
        where: { scope_category_branch: { scope: t.scope, category: t.category, branch: "BANDUNG" } },
        update: {},
        create: { scope: t.scope, category: t.category, branch: "BANDUNG", amount: t.amount },
      })
    )
  );

  await Promise.all(
    Object.entries(DEFAULT_GROUP_MAP).map(([itemGroup, category]) =>
      prisma.itemGroupMapping.upsert({
        where: { itemGroup },
        update: {},
        create: { itemGroup, category, isDefault: true },
      })
    )
  );

  await Promise.all(
    Object.entries(DEFAULT_GROUP_MAP).map(([itemGroup, category]) =>
      prisma.pointGroupMapping.upsert({
        where: { itemGroup },
        update: {},
        create: { itemGroup, category, isDefault: true },
      })
    )
  );

  const outletNames = [...new Set(Object.values(DEFAULT_ALIAS_MAP))];
  const outlets = await prisma.outlet.findMany({ where: { name: { in: outletNames } } });
  const outletIdByName = new Map(outlets.map((o) => [o.name, o.id]));

  await prisma.outlet.upsert({
    where: { name: "BELUM DIPETAKAN" },
    update: {},
    create: { name: "BELUM DIPETAKAN", branch: "BANDUNG", isHidden: false },
  });

  await Promise.all(
    Object.entries(DEFAULT_ALIAS_MAP).map(([alias, outletName]) => {
      const outletId = outletIdByName.get(outletName);
      if (!outletId) return Promise.resolve();
      return prisma.outletAlias.upsert({
        where: { alias },
        update: {},
        create: { alias, outletId, isDefault: true },
      });
    })
  );

  const existingItemPointCount = await prisma.itemPoint.count();
  if (existingItemPointCount === 0) {
    const defaultBaseDate = new Date("2020-01-01T00:00:00.000Z");
    await Promise.all(
      DEFAULT_ITEM_POINTS.map((p) =>
        prisma.itemPoint.upsert({
          where: { pattern_startDate: { pattern: p.pattern, startDate: defaultBaseDate } },
          update: {},
          create: { pattern: p.pattern, points: p.points, startDate: defaultBaseDate, isDefault: true },
        })
      )
    );
  } else {
    // Clean up legacy duplicate-wording rules that conflicted with their canonical counterparts
    await prisma.itemPoint.deleteMany({
      where: {
        OR: [
          { pattern: { equals: "FURLOVE CAN KITTEN SALMON IN JELLY", mode: "insensitive" }, points: 3 },
          { pattern: { equals: "PASIR IMPORT LUMINA 5L", mode: "insensitive" }, points: 10 },
        ],
      },
    });
    const { deduplicateItemPointRules } = await import("@/lib/queries/points");
    await deduplicateItemPointRules();
  }

  await Promise.all(
    DEFAULT_GROUP_POINTS.map((g) =>
      prisma.itemGroupPointDefault.upsert({
        where: { itemGroup: g.itemGroup },
        update: {},
        create: { itemGroup: g.itemGroup, points: g.points },
      })
    )
  );
}
