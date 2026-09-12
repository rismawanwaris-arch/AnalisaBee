import { prisma } from "@/lib/prisma";
import { parseMasterItemBuffer } from "@/lib/parseMasterItems";

export type ItemBranch = "BANDUNG" | "CIMAHI";

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

/** Full item catalog (id/code/name/itemGroup/branch only), for pages that
 *  filter client-side instead of round-tripping per keystroke — worth it
 *  because the catalog is small and bounded (hundreds of SKUs per branch,
 *  not an ever-growing log like Sale), unlike searchItems's capped/paginated
 *  dropdown use. `branch` is included because code is only unique per
 *  branch — two branches can show the same code for different products. */
export async function listAllItems() {
  return prisma.item.findMany({
    where: { isHidden: false },
    select: { id: true, code: true, name: true, itemGroup: true, branch: true },
    orderBy: { name: "asc" },
  });
}

/** Full catalog WITH hidden items and lifetime sales sums — for the "Visibilitas
 *  Item" settings panel only. Mirrors getOutletList / getEmployeeList. */
export async function listItemsForVisibility() {
  const [items, sums] = await Promise.all([
    prisma.item.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        itemGroup: true,
        branch: true,
        isHidden: true,
        isFromSalesImport: true,
      },
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
        branch: i.branch,
        isHidden: i.isHidden,
        isFromSalesImport: i.isFromSalesImport,
        qty: s?._sum.qty ?? 0,
        subtotal: Number(s?._sum.subtotal ?? 0),
        transactionCount: s?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
}

// ==========================================
// MASTER ITEM IMPORT — the source of truth for item code -> name/kategori
// per cabang, uploaded by master via Settings. Independent from sales
// import: sales import only MATCHES against this list (see importSales.ts),
// it no longer invents item definitions from whatever a transaction file
// happens to say.
// ==========================================

const PREVIEW_CHANGE_CAP = 500;

export interface MasterItemChangeRow {
  rowNumber: number;
  code: string;
  name: string;
  itemGroup: string | null;
  status: "NEW" | "UPDATE";
  previousName?: string;
  previousItemGroup?: string | null;
}

export interface MasterItemPreview {
  branch: ItemBranch;
  totalRows: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  errors: { rowNumber: number; message: string }[];
  /** NEW + UPDATE rows only, capped — UNCHANGED rows aren't worth listing. */
  changes: MasterItemChangeRow[];
}

/** Dry-run: classifies every master-item row as NEW / UPDATE / UNCHANGED
 *  against the current (code, branch) catalog, without writing anything.
 *  Mirrors previewSalesFile's preview-before-commit pattern. */
export async function previewMasterItemImport(
  buffer: Buffer,
  branch: ItemBranch
): Promise<MasterItemPreview> {
  const { rows, errors, duplicateInFileCount, totalRows } = parseMasterItemBuffer(buffer);

  const existing = await prisma.item.findMany({
    where: { branch, code: { in: rows.map((r) => r.code) } },
    select: { code: true, name: true, itemGroup: true },
  });
  const existingByCode = new Map(existing.map((i) => [i.code, i]));

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  const changes: MasterItemChangeRow[] = [];

  for (const r of rows) {
    const ex = existingByCode.get(r.code);
    if (!ex) {
      newCount++;
      if (changes.length < PREVIEW_CHANGE_CAP) changes.push({ ...r, status: "NEW" });
    } else if (ex.name !== r.name || (ex.itemGroup ?? null) !== r.itemGroup) {
      updateCount++;
      if (changes.length < PREVIEW_CHANGE_CAP) {
        changes.push({
          ...r,
          status: "UPDATE",
          previousName: ex.name,
          previousItemGroup: ex.itemGroup,
        });
      }
    } else {
      unchangedCount++;
    }
  }

  return {
    branch,
    totalRows,
    newCount,
    updateCount,
    unchangedCount,
    duplicateInFileCount,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
    changes,
  };
}

export interface MasterItemImportSummary {
  branch: ItemBranch;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  duplicateInFileCount: number;
  errorCount: number;
}

const UPDATE_CHUNK_SIZE = 200;

/** Upserts the master item list for one branch by (code, branch): creates
 *  rows that don't exist yet, updates name/itemGroup where they changed, and
 *  clears isFromSalesImport on any match — an official master definition
 *  always wins over a fallback one created during sales import. */
export async function importMasterItems(
  buffer: Buffer,
  branch: ItemBranch
): Promise<MasterItemImportSummary> {
  const { rows, errors, duplicateInFileCount, totalRows } = parseMasterItemBuffer(buffer);

  const existing = await prisma.item.findMany({
    where: { branch, code: { in: rows.map((r) => r.code) } },
    select: { id: true, code: true, name: true, itemGroup: true },
  });
  const existingByCode = new Map(existing.map((i) => [i.code, i]));

  const toCreate: { code: string; name: string; itemGroup: string | null }[] = [];
  const toUpdate: { id: number; name: string; itemGroup: string | null }[] = [];
  let unchangedCount = 0;

  for (const r of rows) {
    const ex = existingByCode.get(r.code);
    if (!ex) {
      toCreate.push({ code: r.code, name: r.name, itemGroup: r.itemGroup });
    } else if (ex.name !== r.name || (ex.itemGroup ?? null) !== r.itemGroup) {
      toUpdate.push({ id: ex.id, name: r.name, itemGroup: r.itemGroup });
    } else {
      unchangedCount++;
    }
  }

  if (toCreate.length) {
    await prisma.item.createMany({
      data: toCreate.map((i) => ({ ...i, branch, isFromSalesImport: false })),
      skipDuplicates: true,
    });
  }

  for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.item.update({
          where: { id: u.id },
          data: { name: u.name, itemGroup: u.itemGroup, isFromSalesImport: false },
        })
      )
    );
  }

  return {
    branch,
    totalRows,
    createdCount: toCreate.length,
    updatedCount: toUpdate.length,
    unchangedCount,
    duplicateInFileCount,
    errorCount: errors.length,
  };
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
    item: { id: item.id, code: item.code, name: item.name, itemGroup: item.itemGroup, branch: item.branch },
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
