import { prisma } from "@/lib/prisma";

export async function getOutletList() {
  const [outlets, sums] = await Promise.all([
    prisma.outlet.findMany({ orderBy: { name: "asc" } }),
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

  const [totals, byItem, byDate] = await Promise.all([
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
  ]);

  const items = await prisma.item.findMany({ where: { id: { in: byItem.map((i) => i.itemId) } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

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
    })),
    trend: byDate.map((g) => ({
      tanggal: g.tanggal.toISOString(),
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
    })),
  };
}
