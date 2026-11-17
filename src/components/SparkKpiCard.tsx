
import { useEffect, useId, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useCountUp } from "@/hooks/useCountUp";

interface SparkKpiCardProps {
  label: string;
  value: string;
  numericValue?: number;
  formatValue?: (n: number) => string;
  trendPct: number | null;
  series: number[];
  hint?: string;
  compareLabel?: string;
  compareTooltip?: string;
  delayMs?: number;
}

export function SparkKpiCard({
  label,
  value,
  numericValue,
  formatValue,
  trendPct,
  series,
  hint,
  compareLabel,
  compareTooltip,
  delayMs = 0,
}: SparkKpiCardProps) {
  const rawId = useId();
  const gradientId = `spark_${rawId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const [mounted, setMounted] = useState(false);
  const animatedNumeric = useCountUp(numericValue);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayValue =
    numericValue !== undefined && formatValue ? formatValue(animatedNumeric) : value;

  const positive = (trendPct ?? 0) >= 0;
  const data = series.map((v) => ({ v }));
  const sparkData = data.length === 1 ? [{ v: data[0].v }, { v: data[0].v }] : data;

  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className="animate-enter group relative rounded-xl border border-border/80 bg-surface p-4 shadow-xs hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted/80">
            {label}
          </span>
          {trendPct !== null ? (
            <span
              title={compareTooltip}
              className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border shadow-2xs ${
                positive
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
              }`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={positive ? "" : "rotate-180"}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>{Math.abs(trendPct).toFixed(1)}%</span>
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-mono text-muted bg-surface-subtle px-1.5 py-0.5 rounded border border-border/50">
              Periode ini
            </span>
          )}
        </div>

        <div className="text-xl xl:text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground">
          {displayValue}
        </div>

        {hint && (
          <div className="text-[11px] text-muted font-medium mt-1">
            {hint}
          </div>
        )}
        {compareLabel && (
          <div
            title={compareTooltip}
            className="text-[10px] font-medium mt-0.5 text-muted/90 truncate"
          >
            {compareLabel}
          </div>
        )}
      </div>

      {mounted && sparkData.length > 0 && (
        <div className="h-9 -mx-2 -mb-2 mt-3 pt-1">
          <ResponsiveContainer width="100%" height={36}>
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--chart-line)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={true}
                animationDuration={750}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
