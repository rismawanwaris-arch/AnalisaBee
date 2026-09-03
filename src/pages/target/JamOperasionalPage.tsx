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

export function JamOperasionalPage() {
  const [date, setDate] = useState(yesterdayStr());
  const [outletId, setOutletId] = useState("");
  const [granularity, setGranularity] = useState<"EXACT" | "15MIN" | "30MIN" | "1HOUR">("EXACT");
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [data, setData] = useState<HourlyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/outlets")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: OutletOption[]) => setOutlets(list))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date, granularity });
    if (outletId) params.set("outletId", outletId);
    try {
      const res = await fetch(`/api/hourly?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [date, outletId, granularity]);

  useEffect(() => {
    load();
  }, [load]);

  const maxHeat = Math.max(
    1,
    ...(data?.heatmap?.flatMap((r) => OPERATING_HOURS.map((h) => r.counts[h] ?? 0)) ?? [1])
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted">Tanggal:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted">Resolusi:</label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as typeof granularity)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          >
            <option value="EXACT">Presisi (menit)</option>
            <option value="15MIN">Per 15 menit</option>
            <option value="30MIN">Per 30 menit</option>
            <option value="1HOUR">Per 1 jam</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted">Outlet:</label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground min-w-44 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          >
            <option value="">Semua Outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center p-12 text-xs text-muted font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>Memuat data audit operasional...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Kurva Jam Sibuk Transaksi</h2>
              <p className="text-[11px] text-muted">
                Distribusi frekuensi volume transaksi harian berdasarkan waktu struk
              </p>
            </div>
            {data.lineChart.length === 0 ? (
              <div className="text-xs text-muted flex items-center justify-center h-52 border border-dashed border-border/80 rounded-xl">
                Tidak ada transaksi pada tanggal ini.
              </div>
            ) : (
              <div className="pt-2">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.lineChart} margin={{ left: 8, right: 16, top: 12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="time" fontSize={11} stroke="var(--border)" tick={{ fill: "var(--muted)", fontFamily: "var(--font-mono)" }} minTickGap={24} />
                    <YAxis fontSize={11} stroke="var(--border)" tick={{ fill: "var(--muted)", fontFamily: "var(--font-mono)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      }}
                      formatter={(v) => [`${formatNumber(Number(v))} transaksi`, "Volume"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Audit Jam Buka &amp; Tutup per Outlet
              </h2>
              <p className="text-[11px] text-muted">
                Waktu transaksi perdana (buka), pamungkas (tutup), dan jam paling padat
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Outlet</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Jam Buka</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Jam Tutup</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Jam Paling Ramai</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.audit.map((a) => (
                    <tr key={a.outletId} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{a.outlet}</td>
                      <td className="px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{a.firstTime ?? "-"}</td>
                      <td className="px-4 py-2.5 font-mono text-rose-600 dark:text-rose-400 font-semibold">{a.lastTime ?? "-"}</td>
                      <td className="px-4 py-2.5 font-mono text-foreground/80">
                        {a.peakHour !== null
                          ? `${String(a.peakHour).padStart(2, "0")}:00 (${a.peakCount} tx)`
                          : "-"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right text-foreground font-semibold">{formatNumber(a.totalTrx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Heatmap Kepadatan Transaksi ({outlets.length} Outlet × 17 Jam)
              </h2>
              <p className="text-[11px] text-muted">Intensitas warna hijau merepresentasikan kepadatan transaksi</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="border-b border-border/80">
                    <th className="px-3 py-2 text-left bg-surface-subtle/80 text-muted font-semibold uppercase text-[11px] sticky left-0 z-10">Outlet</th>
                    {OPERATING_HOURS.map((h) => (
                      <th key={h} className="px-2 py-2 text-center bg-surface-subtle/80 text-muted font-mono font-semibold text-[11px]">
                        {String(h).padStart(2, "0")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {data.heatmap.map((row) => (
                    <tr key={row.outletId} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap bg-surface font-sans font-medium text-foreground sticky left-0 border-r border-border/60 z-10">
                        {row.outlet}
                      </td>
                      {OPERATING_HOURS.map((h) => {
                        const val = row.counts[h] ?? 0;
                        const intensity = val / maxHeat;
                        return (
                          <td
                            key={h}
                            className="px-2 py-2 text-center text-[11px] transition-colors"
                            style={{
                              background: val > 0 ? `rgba(16,185,129,${Math.max(0.12, intensity * 0.75)})` : "transparent",
                              color: val > 0 ? "var(--foreground)" : "var(--muted)",
                              fontWeight: val > 0 ? 600 : 400,
                            }}
                          >
                            {val || "-"}
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
