import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import { EXCLUDE_HIDDEN_ITEMS } from "@/lib/queries/_hiddenItems";
import type { BusinessLine, ReportCategory } from "@/generated/prisma/client";

export interface CategoryFigure {
  sales: number;
  qtyOrTrx: number;
}

export interface TargetReportRow {
  outletId: number;
  outlet: string;
  server: CategoryFigure;
  tartun: CategoryFigure;
  petshop: CategoryFigure;
  aksesoris: CategoryFigure;
  spVoucher: CategoryFigure;
  totalSales: number;
  totalQtyTrx: number;
}

export type TargetAmounts = Record<BusinessLine, number>;

const BUSINESS_LINES: BusinessLine[] = ["SERVER", "TARTUN", "PETSHOP", "AKSESORIS", "SP_VOUCHER"];

export async function getTargetAmounts(branch: "BANDUNG" | "CIMAHI" = "BANDUNG"): Promise<{
  perkonter: TargetAmounts;
  all: TargetAmounts;
}> {
  await ensureDefaults(branch);
  const rows = await prisma.target.findMany({ where: { branch } });
  const perkonter = {} as TargetAmounts;
  const all = {} as TargetAmounts;
  for (const line of BUSINESS_LINES) {
    perkonter[line] = 0;
    all[line] = 0;
  }
  for (const r of rows) {
    (r.scope === "PERKONTER" ? perkonter : all)[r.category] = Number(r.amount);
  }
  return { perkonter, all };
}

export async function setTargetAmount(
  scope: "PERKONTER" | "ALL",
  category: BusinessLine,
  amount: number,
  branch: "BANDUNG" | "CIMAHI" = "BANDUNG"
) {
  await prisma.target.upsert({
    where: { scope_category_branch: { scope, category, branch } },
    update: { amount },
    create: { scope, category, branch, amount },
  });
}

function emptyFigure(): CategoryFigure {
  return { sales: 0, qtyOrTrx: 0 };
}

/** Inclusive whole-day count between two date-only values (from == to -> 1). */
export function countDays(from: Date, to: Date): number {
  const ms = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
    - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

export async function getTargetReport(
  from: Date,
  to: Date,
  branch: "BANDUNG" | "CIMAHI" = "BANDUNG"
): Promise<{
  rows: TargetReportRow[];
  unmappedItemGroups: string[];
  dayCount: number;
}> {
  await ensureDefaults(branch);

  const dateRange = { gte: from, lte: to };
  const [outlets, tartunRows, serverRows, saleRows, groupMappings] = await Promise.all([
    prisma.outlet.findMany({ where: { branch }, orderBy: { name: "asc" } }),
    prisma.tartunDaily.findMany({ where: { tanggal: dateRange } }),
    prisma.serverDaily.findMany({ where: { tanggal: dateRange } }),
    prisma.sale.findMany({
      where: { tanggal: dateRange, ...EXCLUDE_HIDDEN_ITEMS },
      select: { outletId: true, qty: true, labaRugi: true, item: { select: { itemGroup: true } } },
    }),
    prisma.itemGroupMapping.findMany(),
  ]);

  const categoryByGroup = new Map<string, ReportCategory>(
    groupMappings.map((m) => [m.itemGroup, m.category])
  );

  const rowsByOutlet = new Map<number, TargetReportRow>();
  for (const o of outlets) {
    rowsByOutlet.set(o.id, {
      outletId: o.id,
      outlet: o.name,
      server: emptyFigure(),
      tartun: emptyFigure(),
      petshop: emptyFigure(),
      aksesoris: emptyFigure(),
      spVoucher: emptyFigure(),
      totalSales: 0,
      totalQtyTrx: 0,
    });
  }

  // Accumulate (not assign) — a date range has one tartun/server row per day
  // per outlet, all of which sum into the outlet's figure for the period.
  for (const t of tartunRows) {
    const row = rowsByOutlet.get(t.outletId);
    if (row) {
      row.tartun.sales += Number(t.sales);
      row.tartun.qtyOrTrx += t.trx;
    }
  }
  for (const s of serverRows) {
    const row = rowsByOutlet.get(s.outletId);
    if (row) {
      row.server.sales += Number(s.sales);
      row.server.qtyOrTrx += s.trx;
    }
  }

  const unmapped = new Set<string>();
  for (const s of saleRows) {
    const row = rowsByOutlet.get(s.outletId);
    if (!row) continue;
    const group = s.item.itemGroup?.trim().toUpperCase() ?? "";
    const category = categoryByGroup.get(group);
    if (!category) {
      if (group) unmapped.add(group);
      continue;
    }
    const labaRugi = Number(s.labaRugi);
    if (category === "PETSHOP") {
      row.petshop.sales += labaRugi;
      row.petshop.qtyOrTrx += s.qty;
    } else if (category === "AKSESORIS") {
      row.aksesoris.sales += labaRugi;
      row.aksesoris.qtyOrTrx += s.qty;
    } else {
      row.spVoucher.sales += labaRugi;
      row.spVoucher.qtyOrTrx += s.qty;
    }
  }

  const rows = [...rowsByOutlet.values()].map((r) => {
    const totalSales =
      r.server.sales + r.tartun.sales + r.petshop.sales + r.aksesoris.sales + r.spVoucher.sales;
    const totalQtyTrx =
      r.server.qtyOrTrx +
      r.tartun.qtyOrTrx +
      r.petshop.qtyOrTrx +
      r.aksesoris.qtyOrTrx +
      r.spVoucher.qtyOrTrx;
    return { ...r, totalSales, totalQtyTrx };
  });

  return { rows, unmappedItemGroups: [...unmapped].sort(), dayCount: countDays(from, to) };
}
