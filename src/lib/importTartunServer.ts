import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import type { TartunServerRow } from "@/lib/parseTartunServer";

export interface ImportDailyMetricSummary {
  matchedOutletCount: number;
  unmatchedNames: string[];
  totalSales: number;
  totalTrx: number;
  fallbackSales: number;
  fallbackTrx: number;
}

export const FALLBACK_OUTLET_NAME = "BELUM DIPETAKAN";

/**
 * Resolves each row's raw name to a canonical outlet (via exact name match or
 * OutletAlias). Any row that cannot be matched is safely assigned to the
 * fallback holding outlet ("BELUM DIPETAKAN") so the daily total remains 100%
 * complete, and recorded in `unmatched_daily_metrics` so that when the user adds
 * an alias later, the data automatically transfers to the target outlet without
 * needing a re-upload.
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

  let fallbackOutletId = outletIdByName.get(FALLBACK_OUTLET_NAME.toUpperCase());
  if (!fallbackOutletId) {
    const fallbackOutlet = await prisma.outlet.upsert({
      where: { name: FALLBACK_OUTLET_NAME },
      update: {},
      create: { name: FALLBACK_OUTLET_NAME, branch: "BANDUNG", isHidden: false },
    });
    fallbackOutletId = fallbackOutlet.id;
  }

  const byOutlet = new Map<number, { sales: number; trx: number }>();
  const unmatched = new Set<string>();
  const unmatchedAgg = new Map<string, { sales: number; trx: number }>();

  for (const r of rows) {
    const key = r.name.toUpperCase();
    const outletId = outletIdByAlias.get(key) ?? outletIdByName.get(key);
    if (!outletId) {
      unmatched.add(r.name);
      const u = unmatchedAgg.get(r.name) ?? { sales: 0, trx: 0 };
      u.sales += r.sales;
      u.trx += r.trx;
      unmatchedAgg.set(r.name, u);

      // Masukkan ke outlet penampungan BELUM DIPETAKAN agar total omzet utuh
      const existingFallback = byOutlet.get(fallbackOutletId) ?? { sales: 0, trx: 0 };
      existingFallback.sales += r.sales;
      existingFallback.trx += r.trx;
      byOutlet.set(fallbackOutletId, existingFallback);
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

  // Jika tidak ada data yang unmatched pada upload ini, bersihkan data fallback lama pada tanggal ini
  if (!unmatchedAgg.size) {
    const fbWhere = { tanggal_outletId: { tanggal: date, outletId: fallbackOutletId } };
    if (kind === "TARTUN") {
      await prisma.tartunDaily.deleteMany({ where: fbWhere });
    } else {
      await prisma.serverDaily.deleteMany({ where: fbWhere });
    }
  }

  // Simpan rincian data unmatched ke tabel penampungan sementara
  await prisma.$executeRawUnsafe(
    `DELETE FROM "unmatched_daily_metrics" WHERE "kind" = $1 AND "tanggal" = $2`,
    kind,
    date
  );

  for (const [rawName, agg] of unmatchedAgg.entries()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "unmatched_daily_metrics" ("kind", "tanggal", "rawName", "sales", "trx")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("kind", "tanggal", "rawName")
       DO UPDATE SET "sales" = EXCLUDED."sales", "trx" = EXCLUDED."trx"`,
      kind,
      date,
      rawName,
      agg.sales,
      agg.trx
    );
  }

  const fallbackMetrics = byOutlet.get(fallbackOutletId) ?? { sales: 0, trx: 0 };
  const totalSales = [...byOutlet.values()].reduce((a, b) => a + b.sales, 0);
  const totalTrx = [...byOutlet.values()].reduce((a, b) => a + b.trx, 0);

  return {
    matchedOutletCount: byOutlet.size - (fallbackMetrics.sales > 0 || fallbackMetrics.trx > 0 ? 1 : 0),
    unmatchedNames: [...unmatched].sort(),
    totalSales,
    totalTrx,
    fallbackSales: fallbackMetrics.sales,
    fallbackTrx: fallbackMetrics.trx,
  };
}
