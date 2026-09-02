import { prisma } from "@/lib/prisma";

export const OPERATING_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export type Granularity = "EXACT" | "15MIN" | "30MIN" | "1HOUR";

export interface AuditRow {
  outletId: number;
  outlet: string;
  firstTime: string | null;
  lastTime: string | null;
  peakHour: number | null;
  peakCount: number;
  totalTrx: number;
}

export interface HeatmapRow {
  outletId: number;
  outlet: string;
  counts: Record<number, number>;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function bucketKey(hour: number, minute: number, granularity: Granularity): string {
  if (granularity === "1HOUR") return `${pad(hour)}:00`;
  if (granularity === "30MIN") return `${pad(hour)}:${pad(Math.floor(minute / 30) * 30)}`;
  if (granularity === "15MIN") return `${pad(hour)}:${pad(Math.floor(minute / 15) * 15)}`;
  return `${pad(hour)}:${pad(minute)}`;
}

export async function getHourlyAnalytics(
  date: Date,
  outletId: number | undefined,
  granularity: Granularity
) {
  const [outlets, sales] = await Promise.all([
    prisma.outlet.findMany({ orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      where: { tanggal: date },
      select: { outletId: true, jamBuat: true },
    }),
  ]);

  const audit = new Map<number, AuditRow>();
  const heatmap = new Map<number, HeatmapRow>();
  for (const o of outlets) {
    audit.set(o.id, {
      outletId: o.id,
      outlet: o.name,
      firstTime: null,
      lastTime: null,
      peakHour: null,
      peakCount: 0,
      totalTrx: 0,
    });
    const counts: Record<number, number> = {};
    OPERATING_HOURS.forEach((h) => (counts[h] = 0));
    heatmap.set(o.id, { outletId: o.id, outlet: o.name, counts });
  }

  const lineBuckets = new Map<string, number>();

  for (const s of sales) {
    const parts = s.jamBuat.split(":");
    if (parts.length < 2) continue;
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

    const auditRow = audit.get(s.outletId);
    if (auditRow) {
      auditRow.totalTrx++;
      if (!auditRow.firstTime || s.jamBuat < auditRow.firstTime) auditRow.firstTime = s.jamBuat;
      if (!auditRow.lastTime || s.jamBuat > auditRow.lastTime) auditRow.lastTime = s.jamBuat;
    }

    const heatRow = heatmap.get(s.outletId);
    if (heatRow && OPERATING_HOURS.includes(hour)) {
      heatRow.counts[hour] = (heatRow.counts[hour] ?? 0) + 1;
    }

    if (!outletId || outletId === s.outletId) {
      const key = bucketKey(hour, minute, granularity);
      lineBuckets.set(key, (lineBuckets.get(key) ?? 0) + 1);
    }
  }

  for (const row of audit.values()) {
    const heat = heatmap.get(row.outletId);
    if (!heat) continue;
    let peakHour: number | null = null;
    let peakCount = -1;
    OPERATING_HOURS.forEach((h) => {
      if (heat.counts[h] > peakCount) {
        peakCount = heat.counts[h];
        peakHour = h;
      }
    });
    row.peakHour = peakCount > 0 ? peakHour : null;
    row.peakCount = Math.max(0, peakCount);
  }

  const lineChart = [...lineBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, count]) => ({ time, count }));

  return {
    lineChart,
    audit: [...audit.values()],
    heatmap: [...heatmap.values()],
  };
}
