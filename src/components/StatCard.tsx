export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="text-base font-bold font-mono text-foreground mt-1 tabular-nums truncate">
        {value}
      </div>
      {hint && <div className="text-[10px] font-mono text-faint mt-0.5">{hint}</div>}
    </div>
  );
}
