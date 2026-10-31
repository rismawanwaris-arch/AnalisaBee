import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import type { ReportCategory } from "@/generated/prisma/client";

export async function listOutletAliases() {
  await ensureDefaults();
  return prisma.outletAlias.findMany({
    include: { outlet: { select: { id: true, name: true } } },
    orderBy: { alias: "asc" },
  });
}

export interface UnmatchedMetricItem {
  rawName: string;
  kind: string;
  totalSales: number;
  totalTrx: number;
  dateCount: number;
  lastDate: string;
}

export async function listUnmatchedMetrics(): Promise<UnmatchedMetricItem[]> {
  await ensureDefaults();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "rawName", "kind",
           SUM("sales")::numeric as "totalSales",
           SUM("trx")::int as "totalTrx",
           COUNT(DISTINCT "tanggal")::int as "dateCount",
           MAX("tanggal")::text as "lastDate"
    FROM "unmatched_daily_metrics"
    GROUP BY "rawName", "kind"
    ORDER BY MAX("tanggal") DESC, "rawName" ASC
  `);
  return rows.map((r) => ({
    rawName: r.rawName,
    kind: r.kind,
    totalSales: Number(r.totalSales ?? 0),
    totalTrx: Number(r.totalTrx ?? 0),
    dateCount: Number(r.dateCount ?? 0),
    lastDate: r.lastDate ? new Date(r.lastDate).toISOString().slice(0, 10) : "",
  }));
}

export async function transferUnmatchedMetrics(alias: string, targetOutletId: number) {
  await ensureDefaults();
  const cleanAlias = alias.trim();
  const fallbackOutlet = await prisma.outlet.findUnique({ where: { name: "BELUM DIPETAKAN" } });
  if (!fallbackOutlet) return { transferredCount: 0 };

  const pending = await prisma.$queryRawUnsafe<
    { id: number; kind: string; tanggal: Date; rawName: string; sales: string | number; trx: number }[]
  >(
    `SELECT * FROM "unmatched_daily_metrics" WHERE UPPER("rawName") = UPPER($1)`,
    cleanAlias
  );

  if (!pending || pending.length === 0) return { transferredCount: 0 };

  for (const p of pending) {
    const kind = p.kind;
    const tanggal = new Date(p.tanggal);
    const sales = Number(p.sales);
    const trx = Number(p.trx);

    if (kind === "TARTUN") {
      // 1. Kurangi dari outlet penampungan BELUM DIPETAKAN
      const fbRow = await prisma.tartunDaily.findUnique({
        where: { tanggal_outletId: { tanggal, outletId: fallbackOutlet.id } },
      });
      if (fbRow) {
        const newSales = Math.max(0, Number(fbRow.sales) - sales);
        const newTrx = Math.max(0, fbRow.trx - trx);
        if (newSales === 0 && newTrx === 0) {
          await prisma.tartunDaily.delete({
            where: { tanggal_outletId: { tanggal, outletId: fallbackOutlet.id } },
          });
        } else {
          await prisma.tartunDaily.update({
            where: { tanggal_outletId: { tanggal, outletId: fallbackOutlet.id } },
            data: { sales: newSales, trx: newTrx },
          });
        }
      }

      // 2. Tambahkan ke outlet tujuan resmi
      const targetRow = await prisma.tartunDaily.findUnique({
        where: { tanggal_outletId: { tanggal, outletId: targetOutletId } },
      });
      if (targetRow) {
        await prisma.tartunDaily.update({
          where: { tanggal_outletId: { tanggal, outletId: targetOutletId } },
          data: {
            sales: Number(targetRow.sales) + sales,
            trx: targetRow.trx + trx,
          },
        });
      } else {
        await prisma.tartunDaily.create({
          data: {
            tanggal,
            outletId: targetOutletId,
            sales,
            trx,
          },
        });
      }
    } else if (kind === "SERVER") {
      // 1. Kurangi dari outlet penampungan BELUM DIPETAKAN
      const fbRow = await prisma.serverDaily.findUnique({
        where: { tanggal_outletId: { tanggal, outletId: fallbackOutlet.id } },
      });
      if (fbRow) {
        const newSales = Math.max(0, Number(fbRow.sales) - sales);
        const newTrx = Math.max(0, fbRow.trx - trx);
        if (newSales === 0 && newTrx === 0) {
          await prisma.serverDaily.delete({
            where: { tanggal_outletId: { tanggal, outletId: fallbackOutlet.id } },
          });
        } else {
          await prisma.serverDaily.update({
            where: { tanggal_outletId: { tanggal, outletId: fallbackOutlet.id } },
            data: { sales: newSales, trx: newTrx },
          });
        }
      }

      // 2. Tambahkan ke outlet tujuan resmi
      const targetRow = await prisma.serverDaily.findUnique({
        where: { tanggal_outletId: { tanggal, outletId: targetOutletId } },
      });
      if (targetRow) {
        await prisma.serverDaily.update({
          where: { tanggal_outletId: { tanggal, outletId: targetOutletId } },
          data: {
            sales: Number(targetRow.sales) + sales,
            trx: targetRow.trx + trx,
          },
        });
      } else {
        await prisma.serverDaily.create({
          data: {
            tanggal,
            outletId: targetOutletId,
            sales,
            trx,
          },
        });
      }
    }
  }

  // Hapus data yang sudah berhasil dipindahkan dari tabel penampungan
  await prisma.$executeRawUnsafe(
    `DELETE FROM "unmatched_daily_metrics" WHERE UPPER("rawName") = UPPER($1)`,
    cleanAlias
  );

  return { transferredCount: pending.length };
}

export async function createOutletAlias(alias: string, outletId: number) {
  const cleanAlias = alias.trim();
  const mapping = await prisma.outletAlias.upsert({
    where: { alias: cleanAlias },
    update: { outletId, isDefault: false },
    create: { alias: cleanAlias, outletId, isDefault: false },
  });

  const { transferredCount } = await transferUnmatchedMetrics(cleanAlias, outletId);

  return { mapping, transferredCount };
}

export async function deleteOutletAlias(id: number) {
  await prisma.outletAlias.delete({ where: { id } });
}

export async function listItemGroupMappings() {
  await ensureDefaults();
  return prisma.itemGroupMapping.findMany({ orderBy: { itemGroup: "asc" } });
}

export async function createItemGroupMapping(itemGroup: string, category: ReportCategory) {
  return prisma.itemGroupMapping.upsert({
    where: { itemGroup },
    update: { category, isDefault: false },
    create: { itemGroup, category, isDefault: false },
  });
}

export async function deleteItemGroupMapping(id: number) {
  await prisma.itemGroupMapping.delete({ where: { id } });
}

export async function listPointGroupMappings() {
  await ensureDefaults();
  return prisma.pointGroupMapping.findMany({ orderBy: { itemGroup: "asc" } });
}

export async function createPointGroupMapping(itemGroup: string, category: ReportCategory) {
  return prisma.pointGroupMapping.upsert({
    where: { itemGroup },
    update: { category, isDefault: false },
    create: { itemGroup, category, isDefault: false },
  });
}

export async function deletePointGroupMapping(id: number) {
  await prisma.pointGroupMapping.delete({ where: { id } });
}
