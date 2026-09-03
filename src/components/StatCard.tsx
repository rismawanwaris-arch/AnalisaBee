export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs hover:border-border hover:shadow-sm transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted/80">{label}</div>
        <div className="text-xl xl:text-2xl font-bold font-mono text-foreground mt-2 tracking-tight tabular-nums">
          {value}
        </div>
      </div>
      {hint && <div className="text-[11px] text-muted font-medium mt-2">{hint}</div>}
    </div>
  );
}

