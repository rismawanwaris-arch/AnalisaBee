import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import type { ParsedPurchaseInvoice } from "@/lib/parsePurchases";

export interface PurchaseFilters {
  from?: Date;
  to?: Date;
  vendor?: string;
  outletName?: string;
  search?: string;
}

export interface VendorSummaryRow {
  vendor: string;
  invoiceCount: number;
  totalSpend: number;
  totalQty: number;
  distinctItemCount: number;
  avgPerInvoice: number;
  percentage: number;
}

export interface PurchaseInvoiceListItem {
  id: number;
  invoiceNumber: string;
  date: string;
  vendor: string;
  outletName: string;
  currency: string;
  itemCount: number;
  totalQty: number;
  subtotal: number;
  discount: number;
  tax: number;
  otherFee: number;
  total: number;
}

export interface PurchaseInvoiceDetailItem {
  id: number;
  itemSeq: number | null;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  price: number;
  discount: number;
  tax: number;
  subtotal: number;
}

export interface PurchaseInvoiceDetail {
  id: number;
  invoiceNumber: string;
  date: string;
  refInvoice: string | null;
  outletName: string;
  vendor: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  otherFee: number;
  total: number;
  items: PurchaseInvoiceDetailItem[];
}

export interface PurchaseKpiSummary {
  totalSpend: number;
  invoiceCount: number;
  vendorCount: number;
  totalQty: number;
  distinctItemCount: number;
}

export interface TopPurchasedItemRow {
  itemCode: string;
  itemName: string;
  vendor: string;
  totalQty: number;
  totalSpend: number;
  avgPrice: number;
}

function buildWhereClause(filters: PurchaseFilters) {
  const where: any = {};
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = filters.from;
    if (filters.to) where.date.lte = filters.to;
  }
  if (filters.vendor) {
    where.vendor = filters.vendor;
  }
  if (filters.outletName) {
    where.outletName = filters.outletName;
  }
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { vendor: { contains: q, mode: "insensitive" } },
      { outletName: { contains: q, mode: "insensitive" } },
      { items: { some: { itemName: { contains: q, mode: "insensitive" } } } },
    ];
  }
  return where;
}

export async function getPurchaseSummary(filters: PurchaseFilters = {}): Promise<PurchaseKpiSummary> {
  await ensureDefaults();
  const where = buildWhereClause(filters);

  const [invoices, totalQtyAgg] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where,
      select: {
        total: true,
        vendor: true,
      },
    }),
    prisma.purchaseItem.aggregate({
      where: {
        invoice: where,
      },
      _sum: { qty: true },
      _count: { itemCode: true },
    }),
  ]);

  let totalSpend = 0;
  const vendors = new Set<string>();
  for (const inv of invoices) {
    totalSpend += Number(inv.total);
    vendors.add(inv.vendor);
  }

  return {
    totalSpend,
    invoiceCount: invoices.length,
    vendorCount: vendors.size,
    totalQty: Number(totalQtyAgg._sum.qty ?? 0),
    distinctItemCount: totalQtyAgg._count.itemCode,
  };
}

export async function getPurchaseByVendors(filters: PurchaseFilters = {}): Promise<VendorSummaryRow[]> {
  await ensureDefaults();
  const where = buildWhereClause(filters);

  const invoices = await prisma.purchaseInvoice.findMany({
    where,
    include: {
      items: {
        select: {
          itemCode: true,
          qty: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  let grandTotalSpend = 0;
  const vendorMap = new Map<
    string,
    {
      invoiceCount: number;
      totalSpend: number;
      totalQty: number;
      itemCodes: Set<string>;
    }
  >();

  for (const inv of invoices) {
    const spend = Number(inv.total);
    grandTotalSpend += spend;
    const v = vendorMap.get(inv.vendor) ?? {
      invoiceCount: 0,
      totalSpend: 0,
      totalQty: 0,
      itemCodes: new Set<string>(),
    };
    v.invoiceCount += 1;
    v.totalSpend += spend;
    for (const it of inv.items) {
      v.totalQty += Number(it.qty);
      v.itemCodes.add(it.itemCode);
    }
    vendorMap.set(inv.vendor, v);
  }

  const rows: VendorSummaryRow[] = Array.from(vendorMap.entries()).map(([vendor, stat]) => ({
    vendor,
    invoiceCount: stat.invoiceCount,
    totalSpend: stat.totalSpend,
    totalQty: stat.totalQty,
    distinctItemCount: stat.itemCodes.size,
    avgPerInvoice: stat.invoiceCount > 0 ? stat.totalSpend / stat.invoiceCount : 0,
    percentage: grandTotalSpend > 0 ? (stat.totalSpend / grandTotalSpend) * 100 : 0,
  }));

  rows.sort((a, b) => b.totalSpend - a.totalSpend);
  return rows;
}

export async function getPurchaseInvoices(
  filters: PurchaseFilters = {},
  page = 1,
  pageSize = 50
): Promise<{ rows: PurchaseInvoiceListItem[]; totalCount: number; page: number; pageSize: number }> {
  await ensureDefaults();
  const where = buildWhereClause(filters);

  const [totalCount, rawInvoices] = await Promise.all([
    prisma.purchaseInvoice.count({ where }),
    prisma.purchaseInvoice.findMany({
      where,
      include: {
        items: {
          select: {
            qty: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { invoiceNumber: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows: PurchaseInvoiceListItem[] = rawInvoices.map((inv) => {
    let totalQty = 0;
    for (const it of inv.items) {
      totalQty += Number(it.qty);
    }
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date.toISOString().slice(0, 10),
      vendor: inv.vendor,
      outletName: inv.outletName,
      currency: inv.currency,
      itemCount: inv.items.length,
      totalQty,
      subtotal: Number(inv.subtotal),
      discount: Number(inv.discount),
      tax: Number(inv.tax),
      otherFee: Number(inv.otherFee),
      total: Number(inv.total),
    };
  });

  return { rows, totalCount, page, pageSize };
}

export async function getPurchaseInvoiceDetail(
  idOrNumber: number | string
): Promise<PurchaseInvoiceDetail | null> {
  await ensureDefaults();
  const where =
    typeof idOrNumber === "number"
      ? { id: idOrNumber }
      : { invoiceNumber: String(idOrNumber).trim() };

  const inv = await prisma.purchaseInvoice.findUnique({
    where,
    include: {
      items: {
        orderBy: [{ itemSeq: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!inv) return null;

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    date: inv.date.toISOString().slice(0, 10),
    refInvoice: inv.refInvoice,
    outletName: inv.outletName,
    vendor: inv.vendor,
    currency: inv.currency,
    subtotal: Number(inv.subtotal),
    tax: Number(inv.tax),
    discount: Number(inv.discount),
    otherFee: Number(inv.otherFee),
    total: Number(inv.total),
    items: inv.items.map((it) => ({
      id: it.id,
      itemSeq: it.itemSeq,
      itemCode: it.itemCode,
      itemName: it.itemName,
      qty: Number(it.qty),
      unit: it.unit,
      price: Number(it.price),
      discount: Number(it.discount),
      tax: Number(it.tax),
      subtotal: Number(it.subtotal),
    })),
  };
}

export async function getTopPurchasedItems(
  filters: PurchaseFilters = {},
  limit = 20
): Promise<TopPurchasedItemRow[]> {
  await ensureDefaults();
  const where = buildWhereClause(filters);

  const rawItems = await prisma.purchaseItem.findMany({
    where: { invoice: where },
    select: {
      itemCode: true,
      itemName: true,
      qty: true,
      subtotal: true,
      invoice: {
        select: { vendor: true },
      },
    },
  });

  const byItem = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      vendors: Map<string, number>;
      totalQty: number;
      totalSpend: number;
    }
  >();

  for (const it of rawItems) {
    const key = `${it.itemCode}:${it.itemName}`;
    const qty = Number(it.qty);
    const spend = Number(it.subtotal);
    const rec = byItem.get(key) ?? {
      itemCode: it.itemCode,
      itemName: it.itemName,
      vendors: new Map<string, number>(),
      totalQty: 0,
      totalSpend: 0,
    };
    rec.totalQty += qty;
    rec.totalSpend += spend;
    rec.vendors.set(it.invoice.vendor, (rec.vendors.get(it.invoice.vendor) ?? 0) + spend);
    byItem.set(key, rec);
  }

  const rows: TopPurchasedItemRow[] = Array.from(byItem.values()).map((r) => {
    let topVendor = "-";
    let maxSpend = -1;
    for (const [v, spend] of r.vendors.entries()) {
      if (spend > maxSpend) {
        maxSpend = spend;
        topVendor = v;
      }
    }
    return {
      itemCode: r.itemCode,
      itemName: r.itemName,
      vendor: topVendor,
      totalQty: r.totalQty,
      totalSpend: r.totalSpend,
      avgPrice: r.totalQty > 0 ? r.totalSpend / r.totalQty : 0,
    };
  });

  rows.sort((a, b) => b.totalSpend - a.totalSpend);
  return rows.slice(0, limit);
}

export async function listPurchasedVendors(): Promise<string[]> {
  await ensureDefaults();
  const rows = await prisma.purchaseInvoice.findMany({
    select: { vendor: true },
    distinct: ["vendor"],
    orderBy: { vendor: "asc" },
  });
  return rows.map((r) => r.vendor).filter(Boolean);
}

export async function listPurchasedOutlets(): Promise<string[]> {
  await ensureDefaults();
  const rows = await prisma.purchaseInvoice.findMany({
    select: { outletName: true },
    distinct: ["outletName"],
    orderBy: { outletName: "asc" },
  });
  return rows.map((r) => r.outletName).filter(Boolean);
}

export async function importPurchases(
  invoices: ParsedPurchaseInvoice[],
  filename = "import_pembelian"
): Promise<{
  batchId: number;
  totalInvoices: number;
  totalItems: number;
  insertedInvoices: number;
  updatedInvoices: number;
  totalSpend: number;
}> {
  await ensureDefaults();

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let totalItemsCount = 0;
  let totalSpend = 0;

  for (const inv of invoices) {
    if (!minDate || inv.date < minDate) minDate = inv.date;
    if (!maxDate || inv.date > maxDate) maxDate = inv.date;
    totalItemsCount += inv.items.length;
    totalSpend += inv.total;
  }

  const batch = await prisma.purchaseBatch.create({
    data: {
      filename,
      status: "DONE",
      rowCount: totalItemsCount,
      insertedCount: invoices.length,
      periodStart: minDate,
      periodEnd: maxDate,
    },
  });

  let insertedInvoices = 0;
  let updatedInvoices = 0;

  for (const inv of invoices) {
    const existing = await prisma.purchaseInvoice.findUnique({
      where: { invoiceNumber: inv.invoiceNumber },
      select: { id: true },
    });

    if (existing) {
      updatedInvoices++;
      await prisma.purchaseInvoice.update({
        where: { id: existing.id },
        data: {
          date: inv.date,
          refInvoice: inv.refInvoice,
          outletName: inv.outletName,
          vendor: inv.vendor,
          currency: inv.currency,
          subtotal: inv.subtotal,
          tax: inv.tax,
          discount: inv.discount,
          otherFee: inv.otherFee,
          total: inv.total,
          batchId: batch.id,
          items: {
            deleteMany: {},
            create: inv.items.map((it) => ({
              itemSeq: it.itemSeq,
              itemCode: it.itemCode,
              itemName: it.itemName,
              qty: it.qty,
              unit: it.unit,
              discount: it.discount,
              tax: it.tax,
              price: it.price,
              subtotal: it.subtotal,
            })),
          },
        },
      });
    } else {
      insertedInvoices++;
      await prisma.purchaseInvoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          refInvoice: inv.refInvoice,
          outletName: inv.outletName,
          vendor: inv.vendor,
          currency: inv.currency,
          subtotal: inv.subtotal,
          tax: inv.tax,
          discount: inv.discount,
          otherFee: inv.otherFee,
          total: inv.total,
          batchId: batch.id,
          items: {
            create: inv.items.map((it) => ({
              itemSeq: it.itemSeq,
              itemCode: it.itemCode,
              itemName: it.itemName,
              qty: it.qty,
              unit: it.unit,
              discount: it.discount,
              tax: it.tax,
              price: it.price,
              subtotal: it.subtotal,
            })),
          },
        },
      });
    }
  }

  return {
    batchId: batch.id,
    totalInvoices: invoices.length,
    totalItems: totalItemsCount,
    insertedInvoices,
    updatedInvoices,
    totalSpend,
  };
}

export async function deletePurchaseInvoice(id: number): Promise<void> {
  await prisma.purchaseInvoice.delete({ where: { id } });
}
