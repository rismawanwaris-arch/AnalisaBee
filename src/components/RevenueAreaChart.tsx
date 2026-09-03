
import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactRupiah, formatDate, formatRupiah } from "@/lib/format";

interface TrendPoint {
  tanggal: string;
  subtotal: number;
  labaRugi: number;
}

type Metric = "subtotal" | "labaRugi";

const METRIC_LABEL: Record<Metric, string> = {
  subtotal: "Total Omzet",
  labaRugi: "Total Laba",
};

export function RevenueAreaChart({
  data,
  labaTargetPerDay,
}: {
  data: TrendPoint[];
  labaTargetPerDay?: number | null;
}) {
  const rawId = useId();
  const gradientId = `rev_${rawId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const [metric, setMetric] = useState<Metric>("subtotal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showBaseline = metric === "labaRugi" && !!labaTargetPerDay && labaTargetPerDay > 0;

  // If there is only 1 point, create a twin point across the day so AreaChart draws a visible line/area
  const chartData =
    data.length === 1
      ? [
          { ...data[0], _key: "start" },
          { ...data[0], _key: "end" },
        ]
      : data;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground tracking-tight">Tren Performa Harian</h2>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/70 rounded px-1.5 py-0.5">
              {data.length} hari
            </span>
          </div>
          {showBaseline ? (
            <p className="text-xs text-muted font-mono mt-0.5">
              Baseline target laba: <span className="font-semibold text-foreground">{formatRupiah(labaTargetPerDay!)}</span>/hari
            </p>
          ) : (
            <p className="text-xs text-muted mt-0.5">
              Pergerakan {METRIC_LABEL[metric].toLowerCase()} sepanjang rentang waktu terpilih.
            </p>
          )}
        </div>

        {/* Segmented Control Pill */}
        <div className="inline-flex rounded-lg border border-border/80 p-1 bg-surface-subtle shadow-2xs">
          {(["subtotal", "labaRugi"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                metric === m
                  ? "bg-surface text-foreground shadow-xs border border-border/60"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {m === "subtotal" ? "Omzet" : "Laba"}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-xs text-muted flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
          Belum ada data grafik untuk rentang ini.
        </div>
      ) : !mounted ? (
        <div className="h-72 w-full rounded-xl bg-surface-subtle/40 animate-pulse flex items-center justify-center text-xs text-muted">
          Memuat grafik performa...
        </div>
      ) : (
        <div className="w-full pt-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="tanggal"
                tickFormatter={(v) => formatDate(v)}
                tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
                minTickGap={28}
                stroke="var(--border)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompactRupiah(Number(v))}
                tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
                width={72}
                stroke="var(--border)"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const val = Number(payload[0].value);
                  return (
                    <div className="rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md p-3 shadow-lg text-xs space-y-1">
                      <div className="font-medium text-muted font-mono">{formatDate(String(label))}</div>
                      <div className="text-sm font-bold font-mono tabular-nums text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                        {formatRupiah(val)}
                      </div>
                      <div className="text-[10px] text-muted">{METRIC_LABEL[metric]}</div>
                    </div>
                  );
                }}
              />
              {showBaseline && (
                <ReferenceLine
                  y={labaTargetPerDay!}
                  stroke="var(--chart-baseline)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{
                    value: "TARGET LABA",
                    position: "insideTopRight",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--chart-baseline)",
                    fontWeight: 600,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--chart-line)"
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={{ r: 4, fill: "var(--surface)", stroke: "var(--chart-line)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "var(--chart-line)", stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
