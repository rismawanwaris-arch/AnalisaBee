import { prisma } from "../prisma";

export type TransactionSource = "SALE" | "TARTUN" | "SERVER";

export interface UnifiedTransactionRow {
  id: string; // `${source}:${originalId}` — unique across all three sources
  source: TransactionSource;
  sourceId: number;
  tanggal: string; // ISO date (yyyy-mm-dd)
  jam: string | null; // HH:MM:SS for Sale; null for the daily-aggregate sources
  outletId: number;
  outletName: string;
  jumlah: number;
  keterangan: string;
  detail: Record<string, unknown>;
}

export interface DataExplorerFilters {
  from?: Date;
  to?: Date;
}

const SOURCE_LABEL: Record<TransactionSource, string> = {
  SALE: "Data Penjualan",
  TARTUN: "Data Tarik Tunai",
  SERVER: "Data Komisi Server",
};

export function sourceLabel(source: TransactionSource): string {
  return SOURCE_LABEL[source];
}

export async function getUnifiedTransactions(
  filters: DataExplorerFilters = {},
): Promise<UnifiedTransactionRow[]> {
  const dateWhere = {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
  const hasDateFilter = Object.keys(dateWhere).length > 0;

  const [sales, tartun, server] = await Promise.all([
    prisma.sale.findMany({
      where: hasDateFilter ? { tanggal: dateWhere } : undefined,
      select: {
        id: true,
        tanggal: true,
        jamBuat: true,
        noTransaksi: true,
        customer: true,
        qty: true,
        unit: true,
        hargaJual: true,
        diskon: true,
        subtotal: true,
        hpp: true,
        labaRugi: true,
        outlet: { select: { id: true, name: true } },
        item: { select: { code: true, name: true } },
        employee: { select: { name: true } },
        import: { select: { filename: true } },
      },
      orderBy: { tanggal: "desc" },
    }),
    prisma.tartunDaily.findMany({
      where: hasDateFilter ? { tanggal: dateWhere } : undefined,
      select: {
        id: true,
        tanggal: true,
        sales: true,
        trx: true,
        updatedAt: true,
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { tanggal: "desc" },
    }),
    prisma.serverDaily.findMany({
      where: hasDateFilter ? { tanggal: dateWhere } : undefined,
      select: {
        id: true,
        tanggal: true,
        sales: true,
        trx: true,
        updatedAt: true,
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { tanggal: "desc" },
    }),
  ]);

  const rows: UnifiedTransactionRow[] = [];

  for (const s of sales) {
    rows.push({
      id: `SALE:${s.id}`,
      source: "SALE",
      sourceId: s.id,
      tanggal: s.tanggal.toISOString().slice(0, 10),
      jam: s.jamBuat,
      outletId: s.outlet.id,
      outletName: s.outlet.name,
      jumlah: Number(s.subtotal),
      keterangan: `${s.item.name} x${s.qty} — ${s.employee.name}`,
      detail: {
        noTransaksi: s.noTransaksi,
        customer: s.customer,
        itemCode: s.item.code,
        itemName: s.item.name,
        qty: s.qty,
        unit: s.unit,
        hargaJual: Number(s.hargaJual),
        diskon: Number(s.diskon),
        subtotal: Number(s.subtotal),
        hpp: Number(s.hpp),
        labaRugi: Number(s.labaRugi),
        employeeName: s.employee.name,
        importFilename: s.import.filename,
      },
    });
  }

  for (const t of tartun) {
    rows.push({
      id: `TARTUN:${t.id}`,
      source: "TARTUN",
      sourceId: t.id,
      tanggal: t.tanggal.toISOString().slice(0, 10),
      jam: null,
      outletId: t.outlet.id,
      outletName: t.outlet.name,
      jumlah: Number(t.sales),
      keterangan: `Tarik Tunai — ${t.trx} transaksi`,
      detail: {
        trx: t.trx,
        sales: Number(t.sales),
        updatedAt: t.updatedAt.toISOString(),
        note: "Ringkasan harian — bukan rincian per transaksi.",
      },
    });
  }

  for (const s of server) {
    rows.push({
      id: `SERVER:${s.id}`,
      source: "SERVER",
      sourceId: s.id,
      tanggal: s.tanggal.toISOString().slice(0, 10),
      jam: null,
      outletId: s.outlet.id,
      outletName: s.outlet.name,
      jumlah: Number(s.sales),
      keterangan: `Komisi Server — ${s.trx} transaksi`,
      detail: {
        trx: s.trx,
        sales: Number(s.sales),
        updatedAt: s.updatedAt.toISOString(),
        note: "Ringkasan harian — bukan rincian per transaksi.",
      },
    });
  }

  rows.sort((a, b) => {
    const dateCompare = b.tanggal.localeCompare(a.tanggal);
    if (dateCompare !== 0) return dateCompare;
    return (b.jam ?? "").localeCompare(a.jam ?? "");
  });

  return rows;
}

export async function deleteUnifiedTransaction(source: TransactionSource, id: number): Promise<void> {
  if (source === "SALE") {
    await prisma.sale.delete({ where: { id } });
  } else if (source === "TARTUN") {
    await prisma.tartunDaily.delete({ where: { id } });
  } else {
    await prisma.serverDaily.delete({ where: { id } });
  }
}

export interface BulkDeleteItem {
  source: TransactionSource;
  id: number;
}

export interface BulkDeleteResult {
  deleted: number;
  notFound: number;
}

/** Deletes each row independently rather than in one transaction — a bulk
 *  selection can span all three source tables, and one missing row (already
 *  deleted by someone else) shouldn't block the rest from going through. */
export async function bulkDeleteUnifiedTransactions(items: BulkDeleteItem[]): Promise<BulkDeleteResult> {
  const saleIds = items.filter((i) => i.source === "SALE").map((i) => i.id);
  const tartunIds = items.filter((i) => i.source === "TARTUN").map((i) => i.id);
  const serverIds = items.filter((i) => i.source === "SERVER").map((i) => i.id);

  const [saleResult, tartunResult, serverResult] = await Promise.all([
    saleIds.length ? prisma.sale.deleteMany({ where: { id: { in: saleIds } } }) : { count: 0 },
    tartunIds.length ? prisma.tartunDaily.deleteMany({ where: { id: { in: tartunIds } } }) : { count: 0 },
    serverIds.length ? prisma.serverDaily.deleteMany({ where: { id: { in: serverIds } } }) : { count: 0 },
  ]);

  const deleted = saleResult.count + tartunResult.count + serverResult.count;
  return { deleted, notFound: items.length - deleted };
}
