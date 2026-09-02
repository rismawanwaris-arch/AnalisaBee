"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparkKpiCardProps {
  label: string;
  value: string;
  trendPct: number | null;
  series: number[];
  /** Optional secondary line under the value, e.g. "Laba kotor Rp 7,7 Jt". */
  hint?: string;
}

export function SparkKpiCard({ label, value, trendPct, series, hint }: SparkKpiCardProps) {
  const positive = (trendPct ?? 0) >= 0;
  const data = series.map((v) => ({ v }));

  return (
    <div className="rounded border border-border bg-surface p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</span>
        {trendPct !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
              positive
                ? "text-status-hit-text bg-status-hit-bg"
                : "text-status-deficit-text bg-status-deficit-bg"
            }`}
          >
            {positive ? "▲" : "▼"} {Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
      </div>
      {/* Never truncate a financial figure — scale the type down instead so the
          full number always reads. */}
      <div className="text-base xl:text-lg 2xl:text-xl font-bold font-mono leading-6 tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="text-[10px] font-mono text-faint -mt-0.5">{hint}</div>}
      {data.length > 1 && (
        <div className="h-7 -mx-1 mt-auto pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--chart-line)"
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
