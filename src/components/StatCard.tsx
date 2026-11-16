import { useCountUp } from "@/hooks/useCountUp";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  numericValue?: number;
  formatValue?: (n: number) => string;
  delayMs?: number;
}

export function StatCard({
  label,
  value,
  hint,
  numericValue,
  formatValue,
  delayMs,
}: StatCardProps) {
  const animatedNumeric = useCountUp(numericValue);
  const displayValue =
    numericValue !== undefined && formatValue ? formatValue(animatedNumeric) : value;

  return (
    <div
      style={delayMs !== undefined ? { animationDelay: `${delayMs}ms` } : undefined}
      className={`${
        delayMs !== undefined ? "animate-enter " : ""
      }group relative rounded-xl border border-border/80 bg-surface p-4 shadow-xs hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted/80">{label}</div>
        <div className="text-xl xl:text-2xl font-bold font-mono text-foreground mt-2 tracking-tight tabular-nums">
          {displayValue}
        </div>
      </div>
      {hint && <div className="text-[11px] text-muted font-medium mt-2">{hint}</div>}
    </div>
  );
}
