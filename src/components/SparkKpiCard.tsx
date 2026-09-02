"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparkKpiCardProps {
  label: string;
  value: string;
  trendPct: number | null;
  series: number[];
}

export function SparkKpiCard({ label, value, trendPct, series }: SparkKpiCardProps) {
  const positive = (trendPct ?? 0) >= 0;
  const data = series.map((v) => ({ v }));

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        {trendPct !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
              positive ? "text-positive bg-positive/10" : "text-negative bg-negative/10"
            }`}
          >
            {positive ? "▲" : "▼"} {Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-xl xl:text-2xl font-semibold tabular-nums text-foreground truncate">
        {value}
      </div>
      {data.length > 1 && (
        <div className="h-8 -mx-1 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--accent)"
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
