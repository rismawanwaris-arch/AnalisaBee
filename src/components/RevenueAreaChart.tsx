"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatRupiah } from "@/lib/format";

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

export function RevenueAreaChart({ data }: { data: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>("subtotal");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">Tren Harian</h2>
        <div className="inline-flex rounded-md border border-border p-0.5 bg-background">
          {(["subtotal", "labaRugi"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
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
        <div className="text-sm text-muted flex items-center justify-center h-64">
          Belum ada data.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="tanggal"
              tickFormatter={(v) => formatDate(v)}
              fontSize={12}
              minTickGap={24}
              stroke="var(--muted)"
            />
            <YAxis
              tickFormatter={(v) => formatRupiah(v)}
              fontSize={11}
              width={90}
              stroke="var(--muted)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
              }}
              labelFormatter={(v) => formatDate(String(v))}
              formatter={(value) => [formatRupiah(Number(value)), METRIC_LABEL[metric]]}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#revenue-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
