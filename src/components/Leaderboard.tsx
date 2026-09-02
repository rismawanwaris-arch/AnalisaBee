import Link from "next/link";
import { formatNumber, formatRupiah } from "@/lib/format";

export interface LeaderboardRow {
  id: number;
  href: string;
  label: string;
  qty: number;
  subtotal: number;
}

export function Leaderboard({ title, rows }: { title: string; rows: LeaderboardRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.subtotal));

  return (
    <div className="rounded border border-border bg-surface overflow-hidden">
      <div className="px-3 py-2 bg-surface-subtle border-b border-border flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted">{title}</h3>
        <span className="text-[10px] font-mono text-faint">{rows.length} baris</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted py-6 text-center">Belum ada data.</p>
      ) : (
        <ol className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={r.id}>
              <Link href={r.href} className="group block px-3 py-2 hover:bg-surface-hover transition-colors">
                <div className="flex items-center justify-between gap-3 text-xs mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-faint w-4 text-right shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate text-foreground group-hover:underline">{r.label}</span>
                  </span>
                  <span className="flex items-baseline gap-2.5 shrink-0 font-mono tabular-nums">
                    <span className="text-[10px] text-muted">{formatNumber(r.qty)} pcs</span>
                    <span className="text-foreground font-medium">{formatRupiah(r.subtotal)}</span>
                  </span>
                </div>
                <div className="h-1 bg-surface-subtle overflow-hidden ml-6 rounded-sm">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${(r.subtotal / max) * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
