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
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Belum ada data.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.id}>
              <Link href={r.href} className="group block">
                <div className="flex items-center justify-between gap-3 text-sm mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted w-4 text-right shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="truncate text-foreground group-hover:underline">{r.label}</span>
                  </span>
                  <span className="flex items-baseline gap-2 shrink-0">
                    <span className="text-xs text-muted tabular-nums">{formatNumber(r.qty)} pcs</span>
                    <span className="tabular-nums text-foreground font-medium">
                      {formatRupiah(r.subtotal)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden ml-6">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
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
