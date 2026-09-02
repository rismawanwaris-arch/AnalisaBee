"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
  subtotal: "Omzet",
  labaRugi: "Laba",
};

export function RevenueAreaChart({
  data,
  /** Daily network-wide LABA target (Petshop + Aksesoris + SP/Voucher, scope
   * ALL), drawn as a dashed baseline. Only valid against the Laba metric —
   * those targets are configured against profit, not revenue — so it is
   * deliberately hidden on the Omzet view rather than compared apples to
   * oranges. Omitted entirely when no target is configured. */
  labaTargetPerDay,
}: {
  data: TrendPoint[];
  labaTargetPerDay?: number | null;
}) {
  const [metric, setMetric] = useState<Metric>("subtotal");
  const showBaseline = metric === "labaRugi" && !!labaTargetPerDay && labaTargetPerDay > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Tren Harian</h2>
          {showBaseline && (
            <p className="text-[10px] font-mono text-faint mt-0.5">
              Baseline target laba {formatRupiah(labaTargetPerDay!)}/hari
            </p>
          )}
        </div>
        <div className="inline-flex rounded border border-border p-0.5 bg-surface-subtle">
          {(["subtotal", "labaRugi"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                metric === m
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-xs text-muted flex items-center justify-center h-64">
          Belum ada data.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid
              stroke="var(--chart-grid)"
              strokeDasharray="2 3"
              vertical={false}
            />
            <XAxis
              dataKey="tanggal"
              tickFormatter={(v) => formatDate(v)}
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
              minTickGap={24}
              stroke="var(--border)"
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatCompactRupiah(Number(v))}
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
              width={64}
              stroke="var(--border)"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 12,
              }}
              labelFormatter={(v) => formatDate(String(v))}
              formatter={(value) => [formatRupiah(Number(value)), METRIC_LABEL[metric]]}
            />
            {showBaseline && (
              <ReferenceLine
                y={labaTargetPerDay!}
                stroke="var(--chart-baseline)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{
                  value: "TARGET",
                  position: "insideTopRight",
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--chart-baseline)",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey={metric}
              stroke="var(--chart-line)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--chart-line)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
