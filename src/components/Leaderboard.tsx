import { Link } from "react-router-dom";
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
    <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
      <div className="px-4 py-3 bg-surface-subtle/70 border-b border-border/80 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
        <span className="text-[11px] font-mono text-muted bg-surface border border-border/60 rounded px-2 py-0.5">
          Top {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted py-8 text-center">Belum ada data untuk periode ini.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((r, i) => {
            const rank = i + 1;
            const isTop3 = rank <= 3;
            const pct = Math.max(4, Math.round((r.subtotal / max) * 100));

            return (
              <Link
                key={r.id}
                to={r.href}
                className="group block px-4 py-3 hover:bg-surface-hover/70 transition-all"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center min-w-0 gap-2.5">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold font-mono shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${
                        rank === 1
                          ? "bg-amber-500/20 text-amber-500 border border-amber-500/40 font-black"
                          : rank === 2
                          ? "bg-slate-400/20 text-slate-300 border border-slate-400/40 font-bold"
                          : rank === 3
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 font-bold"
                          : "bg-surface-subtle text-muted border border-border/60 font-medium"
                      }`}
                    >
                      {rank}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground group-hover:text-accent transition-colors">
                      {r.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                    <span className="text-[11px] text-muted">{formatNumber(r.qty)} pcs</span>
                    <span className="font-bold text-foreground tabular-nums">{formatRupiah(r.subtotal)}</span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden ml-8.5" style={{ width: "calc(100% - 2.25rem)" }}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isTop3
                        ? "bg-gradient-to-r from-blue-500 to-sky-400"
                        : "bg-slate-500/60"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

