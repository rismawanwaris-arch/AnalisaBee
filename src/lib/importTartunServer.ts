import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import type { TartunServerRow } from "@/lib/parseTartunServer";

export interface ImportDailyMetricSummary {
  matchedOutletCount: number;
  unmatchedNames: string[];
  totalSales: number;
  totalTrx: number;
}

/**
 * Resolves each row's raw name to a canonical outlet (via exact name match or
 * OutletAlias), sums same-outlet rows, then upserts one TartunDaily/ServerDaily
 * row per (date, outlet) — replacing whatever was there for that day, since
 * the source export is already a one-row-per-outlet daily total.
 */
export async function importDailyMetric(
  kind: "TARTUN" | "SERVER",
  date: Date,
  rows: TartunServerRow[]
): Promise<ImportDailyMetricSummary> {
  await ensureDefaults();

  const [outlets, aliases] = await Promise.all([
    prisma.outlet.findMany(),
    prisma.outletAlias.findMany(),
  ]);
  const outletIdByName = new Map(outlets.map((o) => [o.name.toUpperCase(), o.id]));
  const outletIdByAlias = new Map(aliases.map((a) => [a.alias.toUpperCase(), a.outletId]));

  const byOutlet = new Map<number, { sales: number; trx: number }>();
  const unmatched = new Set<string>();

  for (const r of rows) {
    const key = r.name.toUpperCase();
    const outletId = outletIdByAlias.get(key) ?? outletIdByName.get(key);
    if (!outletId) {
      unmatched.add(r.name);
      continue;
    }
    const existing = byOutlet.get(outletId) ?? { sales: 0, trx: 0 };
    existing.sales += r.sales;
    existing.trx += r.trx;
    byOutlet.set(outletId, existing);
  }

  await Promise.all(
    [...byOutlet.entries()].map(([outletId, agg]) => {
      const where = { tanggal_outletId: { tanggal: date, outletId } };
      const update = { sales: agg.sales, trx: agg.trx };
      const create = { tanggal: date, outletId, sales: agg.sales, trx: agg.trx };
      return kind === "TARTUN"
        ? prisma.tartunDaily.upsert({ where, update, create })
        : prisma.serverDaily.upsert({ where, update, create });
    })
  );

  const totalSales = [...byOutlet.values()].reduce((a, b) => a + b.sales, 0);
  const totalTrx = [...byOutlet.values()].reduce((a, b) => a + b.trx, 0);

  return {
    matchedOutletCount: byOutlet.size,
    unmatchedNames: [...unmatched].sort(),
    totalSales,
    totalTrx,
  };
}
