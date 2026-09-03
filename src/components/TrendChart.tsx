
import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactRupiah, formatDate, formatNumber, formatRupiah } from "@/lib/format";

interface TrendPoint {
  tanggal: string;
  qty: number;
  subtotal: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const rawId = useId();
  const gradientId = `trend_${rawId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (data.length === 0) {
    return (
      <div className="text-xs text-muted flex items-center justify-center h-56 border border-dashed border-border/80 rounded-xl">
        Belum ada data grafik untuk periode ini.
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="h-72 w-full rounded-xl bg-surface-subtle/40 animate-pulse flex items-center justify-center text-xs text-muted">
        Memuat grafik tren...
      </div>
    );
  }

  const chartData =
    data.length === 1
      ? [
          { ...data[0], _key: "start" },
          { ...data[0], _key: "end" },
        ]
      : data;

  return (
    <div className="w-full pt-2">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
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
                  <div className="text-[10px] text-muted">Omzet Penjualan</div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="subtotal"
            stroke="var(--chart-line)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: "var(--surface)", stroke: "var(--chart-line)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "var(--chart-line)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

