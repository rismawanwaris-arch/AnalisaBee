import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface DashboardFilters {
  from?: Date;
  to?: Date;
  outletId?: number;
}

function buildWhere(filters: DashboardFilters): Prisma.SaleWhereInput {
  const { from, to, outletId } = filters;
  return {
    ...(outletId ? { outletId } : {}),
    ...(from || to
      ? {
          tanggal: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
}

/** Compares the sum of the 2nd half of a series against the 1st half — a lightweight
 * "trending up/down" signal that works for any date range without a second query. */
function trendPct(series: number[]): number | null {
  if (series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = series.slice(mid).reduce((a, b) => a + b, 0);
  if (first === 0) return second === 0 ? 0 : 100;
  return ((second - first) / first) * 100;
}

export async function getDashboardSummary(filters: DashboardFilters = {}) {
  const where = buildWhere(filters);

  const [totals, byDate, topItemsRaw, topOutletsRaw, outletCount, itemCount, employeeCount, latestImport] =
    await Promise.all([
      prisma.sale.aggregate({
        where,
        _sum: { qty: true, subtotal: true, labaRugi: true },
        _count: { _all: true },
      }),
      prisma.sale.groupBy({
        by: ["tanggal"],
        where,
        _sum: { qty: true, subtotal: true, labaRugi: true },
        orderBy: { tanggal: "asc" },
      }),
      prisma.sale.groupBy({
        by: ["itemId"],
        where,
        _sum: { qty: true, subtotal: true },
        orderBy: { _sum: { subtotal: "desc" } },
        take: 10,
      }),
      prisma.sale.groupBy({
        by: ["outletId"],
        where,
        _sum: { qty: true, subtotal: true },
        orderBy: { _sum: { subtotal: "desc" } },
        take: 10,
      }),
      prisma.outlet.count(),
      prisma.item.count(),
      prisma.employee.count(),
      prisma.importBatch.findFirst({ orderBy: { uploadedAt: "desc" } }),
    ]);

  const [items, outlets] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: topItemsRaw.map((i) => i.itemId) } } }),
    prisma.outlet.findMany({ where: { id: { in: topOutletsRaw.map((o) => o.outletId) } } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const outletById = new Map(outlets.map((o) => [o.id, o]));

  const trend = byDate.map((g) => ({
    tanggal: g.tanggal.toISOString(),
    qty: g._sum.qty ?? 0,
    subtotal: Number(g._sum.subtotal ?? 0),
    labaRugi: Number(g._sum.labaRugi ?? 0),
  }));

  return {
    totals: {
      qty: totals._sum.qty ?? 0,
      subtotal: Number(totals._sum.subtotal ?? 0),
      labaRugi: Number(totals._sum.labaRugi ?? 0),
      transactionCount: totals._count._all,
      outletCount,
      itemCount,
      employeeCount,
    },
    trendPct: {
      qty: trendPct(trend.map((t) => t.qty)),
      subtotal: trendPct(trend.map((t) => t.subtotal)),
      labaRugi: trendPct(trend.map((t) => t.labaRugi)),
    },
    trend,
    topItems: topItemsRaw.map((g) => ({
      itemId: g.itemId,
      code: itemById.get(g.itemId)?.code ?? "",
      name: itemById.get(g.itemId)?.name ?? "Tidak diketahui",
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
    })),
    topOutlets: topOutletsRaw.map((g) => ({
      outletId: g.outletId,
      name: outletById.get(g.outletId)?.name ?? "Tidak diketahui",
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
    })),
    latestImport: latestImport
      ? {
          filename: latestImport.filename,
          uploadedAt: latestImport.uploadedAt.toISOString(),
          status: latestImport.status,
        }
      : null,
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;
