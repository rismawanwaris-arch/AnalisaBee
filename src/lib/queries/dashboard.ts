import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { EXCLUDE_HIDDEN_ITEMS } from "@/lib/queries/_hiddenItems";

export type DashboardBranch = "BANDUNG" | "CIMAHI";

export interface DashboardFilters {
  from?: Date;
  to?: Date;
  outletId?: number;
  branch?: DashboardBranch;
}

function buildWhere(filters: DashboardFilters): Prisma.SaleWhereInput {
  const { from, to, outletId, branch } = filters;
  return {
    ...EXCLUDE_HIDDEN_ITEMS,
    ...(outletId ? { outletId } : {}),
    ...(branch ? { outlet: { branch } } : {}),
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

export interface DailyTrendPoint {
  tanggal: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
  laporanHarianTotal: number;
}

export interface DailySalesPointInput {
  tanggal: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
}

/**
 * Pure helper: merges POS daily sales, mapped POS laba (Petshop/Aksesoris/SP),
 * Tarik Tunai daily sales, and Server daily sales into a chronologically sorted
 * series matching the "Total" figure on Laporan Target Harian.
 */
export function mergeDashboardTrend(
  posByDate: DailySalesPointInput[],
  mappedPosLabaByDate: Map<string, number>,
  tartunByDate: Map<string, number>,
  serverByDate: Map<string, number>
): DailyTrendPoint[] {
  const posMap = new Map(posByDate.map((p) => [p.tanggal, p]));
  const allDates = new Set<string>([
    ...posMap.keys(),
    ...mappedPosLabaByDate.keys(),
    ...tartunByDate.keys(),
    ...serverByDate.keys(),
  ]);

  return [...allDates]
    .sort((a, b) => a.localeCompare(b))
    .map((tanggal) => {
      const pos = posMap.get(tanggal);
      const mappedLaba = mappedPosLabaByDate.get(tanggal) ?? 0;
      const tartun = tartunByDate.get(tanggal) ?? 0;
      const server = serverByDate.get(tanggal) ?? 0;
      return {
        tanggal,
        qty: pos?.qty ?? 0,
        subtotal: pos?.subtotal ?? 0,
        labaRugi: pos?.labaRugi ?? 0,
        laporanHarianTotal: mappedLaba + tartun + server,
      };
    });
}

export async function getDashboardSummary(filters: DashboardFilters = {}) {
  const where = buildWhere(filters);
  const { from, to, outletId, branch } = filters;

  const dailyMetricWhere = {
    ...(outletId ? { outletId } : {}),
    ...(branch ? { outlet: { branch } } : {}),
    ...(from || to
      ? {
          tanggal: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [
    totals,
    byDate,
    topItemsRaw,
    topOutletsRaw,
    outletCount,
    itemCount,
    employeeIds,
    latestImport,
    allTargets,
    groupMappings,
    branchItems,
    tartunByDateRaw,
    serverByDateRaw,
  ] = await Promise.all([
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
      prisma.outlet.count({ where: branch ? { branch } : undefined }),
      prisma.item.count({ where: branch ? { branch } : undefined }),
      // Employees aren't tagged with a branch (they can sell at either), so
      // "active employees" is derived from who actually sold within this
      // filter's window/branch, not a raw system-wide headcount.
      prisma.sale.groupBy({ by: ["employeeId"], where }),
      prisma.importBatch.findFirst({
        where: branch ? { branch } : undefined,
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.target.findMany({
        where: {
          scope: "ALL",
          ...(branch ? { branch } : {}),
        },
        select: { category: true, amount: true },
      }),
      prisma.itemGroupMapping.findMany({ select: { itemGroup: true } }),
      prisma.item.findMany({
        where: { isHidden: false, ...(branch ? { branch } : {}) },
        select: { id: true, itemGroup: true },
      }),
      prisma.tartunDaily.groupBy({
        by: ["tanggal"],
        where: dailyMetricWhere,
        _sum: { sales: true },
      }),
      prisma.serverDaily.groupBy({
        by: ["tanggal"],
        where: dailyMetricWhere,
        _sum: { sales: true },
      }),
    ]);
  const employeeCount = employeeIds.length;

  const mappedGroups = new Set(groupMappings.map((m) => m.itemGroup.trim().toUpperCase()));
  const mappedItemIds = branchItems
    .filter((it) => {
      const grp = it.itemGroup?.trim().toUpperCase() ?? "";
      return grp.length > 0 && mappedGroups.has(grp);
    })
    .map((it) => it.id);

  const mappedPosByDateRaw =
    mappedItemIds.length > 0
      ? await prisma.sale.groupBy({
          by: ["tanggal"],
          where: { ...where, itemId: { in: mappedItemIds } },
          _sum: { labaRugi: true },
        })
      : [];

  const [items, outlets] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: topItemsRaw.map((i) => i.itemId) } } }),
    prisma.outlet.findMany({ where: { id: { in: topOutletsRaw.map((o) => o.outletId) } } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const outletById = new Map(outlets.map((o) => [o.id, o]));

  const mappedPosLabaByDate = new Map(
    mappedPosByDateRaw.map((g) => [g.tanggal.toISOString(), Number(g._sum.labaRugi ?? 0)])
  );
  const tartunByDate = new Map(
    tartunByDateRaw.map((g) => [g.tanggal.toISOString(), Number(g._sum.sales ?? 0)])
  );
  const serverByDate = new Map(
    serverByDateRaw.map((g) => [g.tanggal.toISOString(), Number(g._sum.sales ?? 0)])
  );

  const trend = mergeDashboardTrend(
    byDate.map((g) => ({
      tanggal: g.tanggal.toISOString(),
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
      labaRugi: Number(g._sum.labaRugi ?? 0),
    })),
    mappedPosLabaByDate,
    tartunByDate,
    serverByDate
  );

  const posTargetSum = allTargets
    .filter((t) => t.category === "PETSHOP" || t.category === "AKSESORIS" || t.category === "SP_VOUCHER")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const laporanTargetSum = allTargets.reduce((sum, t) => sum + Number(t.amount), 0);

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
    labaTargetPerDay: posTargetSum || null,
    laporanTargetPerDay: laporanTargetSum || null,
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;
