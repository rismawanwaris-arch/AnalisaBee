import { prisma } from "@/lib/prisma";

export async function searchItems(q: string, limit = 20) {
  return prisma.item.findMany({
    where: {
      isHidden: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 50),
  });
}

/** Full item catalog (id/code/name/itemGroup only), for pages that filter
 *  client-side instead of round-tripping per keystroke — worth it because
 *  the catalog is small and bounded (hundreds of SKUs, not an ever-growing
 *  log like Sale), unlike searchItems's capped/paginated dropdown use. */
export async function listAllItems() {
  return prisma.item.findMany({
    where: { isHidden: false },
    select: { id: true, code: true, name: true, itemGroup: true },
    orderBy: { name: "asc" },
  });
}

/** Full catalog WITH hidden items and lifetime sales sums — for the "Visibilitas
 *  Item" settings panel only. Mirrors getOutletList / getEmployeeList. */
export async function listItemsForVisibility() {
  const [items, sums] = await Promise.all([
    prisma.item.findMany({
      select: { id: true, code: true, name: true, itemGroup: true, isHidden: true },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["itemId"],
      _sum: { qty: true, subtotal: true },
      _count: { _all: true },
    }),
  ]);

  const sumByItem = new Map(sums.map((s) => [s.itemId, s]));

  return items
    .map((i) => {
      const s = sumByItem.get(i.id);
      return {
        id: i.id,
        code: i.code,
        name: i.name,
        itemGroup: i.itemGroup,
        isHidden: i.isHidden,
        qty: s?._sum.qty ?? 0,
        subtotal: Number(s?._sum.subtotal ?? 0),
        transactionCount: s?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
}

export interface ItemCategoryRow {
  itemId: number;
  code: string;
  name: string;
  itemGroup: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
}

export async function getItemsByCategory(range: { from?: Date; to?: Date } = {}): Promise<ItemCategoryRow[]> {
  const { from, to } = range;
  const where = {
    item: { isHidden: false },
    ...(from || to
      ? { tanggal: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const sums = await prisma.sale.groupBy({
    by: ["itemId"],
    where,
    _sum: { qty: true, subtotal: true, labaRugi: true },
    orderBy: { _sum: { subtotal: "desc" } },
    take: 500,
  });

  const itemIds = sums.map((s) => s.itemId);
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, code: true, name: true, itemGroup: true },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  return sums
    .map((s) => {
      const item = itemById.get(s.itemId);
      return {
        itemId: s.itemId,
        code: item?.code ?? "",
        name: item?.name ?? "—",
        itemGroup: item?.itemGroup?.trim() || "Tanpa Kategori",
        qty: s._sum.qty ?? 0,
        subtotal: Number(s._sum.subtotal ?? 0),
        labaRugi: Number(s._sum.labaRugi ?? 0),
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
}

export async function getItemDetail(itemId: number, range: { from?: Date; to?: Date } = {}) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return null;

  const { from, to } = range;
  const where = {
    itemId,
    ...(from || to
      ? {
          tanggal: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [byOutletDate, totals] = await Promise.all([
    prisma.sale.groupBy({
      by: ["outletId", "tanggal"],
      where,
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
      orderBy: [{ tanggal: "asc" }],
    }),
    prisma.sale.aggregate({
      where,
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
  ]);

  const outletIds = [...new Set(byOutletDate.map((g) => g.outletId))];
  const outlets = await prisma.outlet.findMany({ where: { id: { in: outletIds } } });

  const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));

  const rows = byOutletDate
    .map((g) => ({
      outletId: g.outletId,
      outletName: outletNameById.get(g.outletId) ?? "Tidak diketahui",
      tanggal: g.tanggal.toISOString(),
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
      labaRugi: Number(g._sum.labaRugi ?? 0),
      transactionCount: g._count._all,
    }))
    .sort(
      (a, b) =>
        new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime() ||
        a.outletName.localeCompare(b.outletName)
    );

  const byOutletMap = new Map<
    number,
    { outletId: number; outletName: string; qty: number; subtotal: number }
  >();
  for (const r of rows) {
    const existing = byOutletMap.get(r.outletId);
    if (existing) {
      existing.qty += r.qty;
      existing.subtotal += r.subtotal;
    } else {
      byOutletMap.set(r.outletId, {
        outletId: r.outletId,
        outletName: r.outletName,
        qty: r.qty,
        subtotal: r.subtotal,
      });
    }
  }
  const byOutlet = [...byOutletMap.values()].sort((a, b) => b.qty - a.qty);

  return {
    item: { id: item.id, code: item.code, name: item.name, itemGroup: item.itemGroup },
    filters: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    totals: {
      qty: totals._sum.qty ?? 0,
      subtotal: Number(totals._sum.subtotal ?? 0),
      labaRugi: Number(totals._sum.labaRugi ?? 0),
      transactionCount: totals._count._all,
      outletCount: byOutlet.length,
    },
    byOutlet,
    rows,
  };
}
