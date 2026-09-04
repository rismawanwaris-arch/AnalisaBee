import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface OutletSummaryFilters {
  from?: Date;
  to?: Date;
  itemId?: number;
  employeeId?: number;
  subtotalMin?: number;
  subtotalMax?: number;
}

export async function getOutletSummary(filters: OutletSummaryFilters = {}) {
  const where: Prisma.SaleWhereInput = { outlet: { isHidden: false } };

  if (filters.from || filters.to) {
    where.tanggal = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const [sums, outlets] = await Promise.all([
    prisma.sale.groupBy({
      by: ["outletId"],
      where,
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
    prisma.outlet.findMany({ where: { isHidden: false }, select: { id: true, name: true } }),
  ]);

  const outletById = new Map(outlets.map((o) => [o.id, o.name]));

  let rows = sums
    .map((s) => ({
      id: s.outletId,
      name: outletById.get(s.outletId) ?? "—",
      qty: s._sum.qty ?? 0,
      subtotal: Number(s._sum.subtotal ?? 0),
      labaRugi: Number(s._sum.labaRugi ?? 0),
      transactionCount: s._count._all,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  if (filters.subtotalMin !== undefined) rows = rows.filter((r) => r.subtotal >= filters.subtotalMin!);
  if (filters.subtotalMax !== undefined) rows = rows.filter((r) => r.subtotal <= filters.subtotalMax!);

  return rows;
}

export async function getOutletList(includeHidden = false) {
  const [outlets, sums] = await Promise.all([
    prisma.outlet.findMany({
      where: includeHidden ? undefined : { isHidden: false },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["outletId"],
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
  ]);

  const sumByOutlet = new Map(sums.map((s) => [s.outletId, s]));

  return outlets
    .map((o) => {
      const s = sumByOutlet.get(o.id);
      return {
        id: o.id,
        name: o.name,
        isHidden: o.isHidden,
        qty: s?._sum.qty ?? 0,
        subtotal: Number(s?._sum.subtotal ?? 0),
        labaRugi: Number(s?._sum.labaRugi ?? 0),
        transactionCount: s?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
}

export async function getOutletDetail(outletId: number) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) return null;

  const [totals, byItem, byDate, byItemEmployee] = await Promise.all([
    prisma.sale.aggregate({
      where: { outletId },
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ["itemId"],
      where: { outletId },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 20,
    }),
    prisma.sale.groupBy({
      by: ["tanggal"],
      where: { outletId },
      _sum: { qty: true, subtotal: true },
      orderBy: { tanggal: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["itemId", "employeeId"],
      where: { outletId },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 500,
    }),
  ]);

  const topItemIds = byItem.map((i) => i.itemId);
  const employeeIds = [...new Set(byItemEmployee.map((r) => r.employeeId))];

  const [items, employees] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: topItemIds } } }),
    prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } }),
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const employeeById = new Map(employees.map((e) => [e.id, e.name]));

  // Group byItemEmployee by itemId for quick lookup
  const employeesByItem = new Map<number, { employeeId: number; employeeName: string; qty: number; subtotal: number }[]>();
  for (const r of byItemEmployee) {
    if (!employeesByItem.has(r.itemId)) employeesByItem.set(r.itemId, []);
    employeesByItem.get(r.itemId)!.push({
      employeeId: r.employeeId,
      employeeName: employeeById.get(r.employeeId) ?? "—",
      qty: r._sum.qty ?? 0,
      subtotal: Number(r._sum.subtotal ?? 0),
    });
  }
  // Sort each item's employee list by subtotal desc
  for (const list of employeesByItem.values()) {
    list.sort((a, b) => b.subtotal - a.subtotal);
  }

  return {
    outlet: { id: outlet.id, name: outlet.name },
    totals: {
      qty: totals._sum.qty ?? 0,
      subtotal: Number(totals._sum.subtotal ?? 0),
      labaRugi: Number(totals._sum.labaRugi ?? 0),
      transactionCount: totals._count._all,
    },
    topItems: byItem.map((g) => ({
      itemId: g.itemId,
      code: itemById.get(g.itemId)?.code ?? "",
      name: itemById.get(g.itemId)?.name ?? "Tidak diketahui",
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
      employees: employeesByItem.get(g.itemId) ?? [],
    })),
    trend: byDate.map((g) => ({
      tanggal: g.tanggal.toISOString(),
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
    })),
  };
}
