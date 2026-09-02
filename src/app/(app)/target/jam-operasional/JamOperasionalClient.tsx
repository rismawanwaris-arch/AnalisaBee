"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";
import { yesterdayStr } from "@/lib/dateDefaults";

const OPERATING_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

interface OutletOption {
  id: number;
  name: string;
}
interface AuditRow {
  outletId: number;
  outlet: string;
  firstTime: string | null;
  lastTime: string | null;
  peakHour: number | null;
  peakCount: number;
  totalTrx: number;
}
interface HeatmapRow {
  outletId: number;
  outlet: string;
  counts: Record<string, number>;
}
interface HourlyResponse {
  lineChart: { time: string; count: number }[];
  audit: AuditRow[];
  heatmap: HeatmapRow[];
}

export function JamOperasionalClient() {
  const [date, setDate] = useState(yesterdayStr());
  const [outletId, setOutletId] = useState("");
  const [granularity, setGranularity] = useState<"EXACT" | "15MIN" | "30MIN" | "1HOUR">("EXACT");
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [data, setData] = useState<HourlyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/outlets")
      .then((r) => r.json())
      .then((list: OutletOption[]) => setOutlets(list));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date, granularity });
    if (outletId) params.set("outletId", outletId);
    const res = await fetch(`/api/hourly?${params.toString()}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [date, outletId, granularity]);

  useEffect(() => {
    load();
  }, [load]);

  const maxHeat = Math.max(
    1,
    ...(data?.heatmap.flatMap((r) => OPERATING_HOURS.map((h) => r.counts[h] ?? 0)) ?? [1])
  );

  return (
    <div className="space-y-6">
      <div className="rounded border border-border bg-surface p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Tanggal</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Resolusi Jam (grafik)</label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as typeof granularity)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="EXACT">Presisi (menit riil)</option>
            <option value="15MIN">Per 15 menit</option>
            <option value="30MIN">Per 30 menit</option>
            <option value="1HOUR">Per 1 jam</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Filter Outlet (grafik)</label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm min-w-48"
          >
            <option value="">Semua Outlet (Total Jaringan)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted">Memuat...</div>
      ) : (
        <>
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground mb-1">Kurva Jam Sibuk</h2>
            <p className="text-xs text-muted mb-3">
              Distribusi transaksi berdasarkan jam transaksi tercatat.
            </p>
            {data.lineChart.length === 0 ? (
              <div className="text-sm text-muted flex items-center justify-center h-48">
                Tidak ada transaksi pada tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.lineChart} margin={{ left: 12, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="time" fontSize={11} stroke="var(--muted)" minTickGap={20} />
                  <YAxis fontSize={12} stroke="var(--muted)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                    formatter={(v) => [formatNumber(Number(v)), "Transaksi"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground mb-1">
              Audit Jam Buka &amp; Tutup per Outlet
            </h2>
            <p className="text-xs text-muted mb-3">
              Transaksi pertama (buka), terakhir (tutup), dan jam paling ramai — semua outlet.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Outlet</th>
                    <th className="px-3 py-2 font-medium">Jam Buka</th>
                    <th className="px-3 py-2 font-medium">Jam Tutup</th>
                    <th className="px-3 py-2 font-medium">Jam Paling Ramai</th>
                    <th className="px-3 py-2 font-medium text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.audit.map((a) => (
                    <tr key={a.outletId}>
                      <td className="px-3 py-2">{a.outlet}</td>
                      <td className="px-3 py-2 text-positive font-medium">{a.firstTime ?? "-"}</td>
                      <td className="px-3 py-2 text-negative font-medium">{a.lastTime ?? "-"}</td>
                      <td className="px-3 py-2">
                        {a.peakHour !== null
                          ? `${String(a.peakHour).padStart(2, "0")}:00 (${a.peakCount} tx)`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(a.totalTrx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground mb-1">
              Heatmap Jam Transaksi ({outlets.length} Outlet × 17 Jam)
            </h2>
            <p className="text-xs text-muted mb-3">Semakin pekat = semakin ramai transaksi.</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-left bg-background text-muted sticky left-0">Outlet</th>
                    {OPERATING_HOURS.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-center bg-background text-muted">
                        {String(h).padStart(2, "0")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.map((row) => (
                    <tr key={row.outletId}>
                      <td className="px-2 py-1 whitespace-nowrap bg-surface sticky left-0 border-r border-border">
                        {row.outlet}
                      </td>
                      {OPERATING_HOURS.map((h) => {
                        const val = row.counts[h] ?? 0;
                        const intensity = val / maxHeat;
                        return (
                          <td
                            key={h}
                            className="px-2 py-1 text-center"
                            style={{
                              background: val > 0 ? `rgba(34,197,94,${Math.max(0.15, intensity)})` : "transparent",
                              color: val > 0 && intensity > 0.5 ? "#fff" : "var(--foreground)",
                            }}
                          >
                            {val || ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
