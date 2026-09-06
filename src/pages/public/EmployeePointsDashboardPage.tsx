import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { todayStr } from "@/lib/dateDefaults";

type Mode = "day" | "week" | "month";

interface CategoryPointRow {
  category: string;
  points: number;
  qty: number;
}

interface PublicPointsRow {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  totalPoints: number;
  pointItemsQty: number;
  achievementPct: number;
  categoryBreakdown: CategoryPointRow[];
}

interface PublicPointsDashboard {
  rows: PublicPointsRow[];
  from: string;
  to: string;
  pointTarget: number;
  outlets: { id: number; name: string }[];
  periodStartDay: number;
}

interface ItemPointBreakdownRow {
  itemId: number;
  itemName: string;
  itemGroup: string | null;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
}

// A period labeled "month M" runs from periodStartDay of M through
// periodStartDay-1 of M+1 (see computeMonthPeriod on the server). So if
// today falls before periodStartDay, the period actually running right now
// started last month, not this one — e.g. periodStartDay=29 and today the
// 6th means the running period is still "last month" (29th – 28th). Same
// logic as PointsLeaderboardPage's currentPeriodMonthStr, duplicated here
// because this page is public and can't call the auth-gated settings route.
function currentPeriodMonthStr(periodStartDay: number): string {
  const d = new Date();
  let year = d.getFullYear();
  let month = d.getMonth() + 1; // 1-12
  if (d.getDate() < periodStartDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

const MODE_LABEL: Record<Mode, string> = { day: "Harian", week: "Mingguan", month: "Bulanan" };

const RANK_BADGE = [
  "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  "bg-slate-400/15 text-slate-500 dark:text-slate-300 border-slate-400/30",
  "bg-orange-600/15 text-orange-600 dark:text-orange-400 border-orange-600/30",
];

// This page is intentionally standalone and public — no login, no
// AuthContext, no sidebar. It's meant to run unattended on a tablet/TV per
// outlet, so it auto-refreshes on its own rather than waiting for a click.
export function EmployeePointsDashboardPage() {
  const [mode, setMode] = useState<Mode>("month");
  const [day, setDay] = useState(todayStr());
  // Guessed with periodStartDay=1 until the first response reveals the real
  // cut-off day, then self-corrected below — same dance PointsLeaderboardPage
  // does, just without an auth-gated settings call this public page can't make.
  const [month, setMonth] = useState(() => currentPeriodMonthStr(1));
  const [periodStartDay, setPeriodStartDay] = useState(1);
  const [outletId, setOutletId] = useState("");
  const [data, setData] = useState<PublicPointsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<ItemPointBreakdownRow[] | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const loadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);
  const monthTouchedRef = useRef(false);

  const queryParams = useCallback(() => {
    const params = new URLSearchParams({ period: mode, date: mode === "month" ? month : day });
    if (outletId) params.set("outletId", outletId);
    return params;
  }, [mode, day, month, outletId]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!hasLoadedOnce.current) setLoading(true); // only spin on the very first load, not on background auto-refresh
    try {
      const res = await fetch(`/api/public/points/dashboard?${queryParams().toString()}`);
      if (seq !== loadSeq.current) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Gagal memuat data.");
        return;
      }
      setError(null);
      const json: PublicPointsDashboard = await res.json();
      setData(json);
      // Self-correct the guessed "current month" once the real cut-off day is
      // known — mirrors PointsLeaderboardPage's currentPeriodMonthStr dance.
      if (json.periodStartDay && json.periodStartDay !== periodStartDay) {
        setPeriodStartDay(json.periodStartDay);
        if (!monthTouchedRef.current) {
          const corrected = currentPeriodMonthStr(json.periodStartDay);
          if (corrected !== month) setMonth(corrected);
        }
      }
    } catch {
      if (seq === loadSeq.current) setError("Terjadi kesalahan jaringan.");
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  }, [queryParams, periodStartDay, month]);

  useEffect(() => {
    load();
    setExpandedId(null);
    setBreakdown(null);
  }, [load]);

  // Unattended auto-refresh so a tablet/TV stays current without anyone touching it.
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function toggleExpand(employeeId: number) {
    if (expandedId === employeeId) {
      setExpandedId(null);
      setBreakdown(null);
      return;
    }
    setExpandedId(employeeId);
    setBreakdown(null);
    setBreakdownLoading(true);
    try {
      const res = await fetch(`/api/public/points/employee/${employeeId}?${queryParams().toString()}`);
      if (res.ok) setBreakdown(await res.json());
    } catch {
      // ignore — the row just won't expand with detail
    } finally {
      setBreakdownLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">🏆 Papan Poin Karyawan</h1>
          <p className="text-xs text-muted">Peringkat pencapaian poin penjualan aksesoris</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-wrap items-center justify-center gap-3 shadow-xs">
          <div className="inline-flex rounded-lg border border-border/80 p-1 bg-surface-subtle shadow-2xs">
            {(["day", "week", "month"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  mode === m ? "bg-accent text-accent-foreground shadow-xs" : "text-muted hover:text-foreground"
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {mode === "month" ? (
            <input
              type="month"
              value={month}
              onChange={(e) => {
                monthTouchedRef.current = true;
                setMonth(e.target.value);
              }}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          ) : (
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          )}
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground min-w-40 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          >
            <option value="">Semua Outlet</option>
            {data?.outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          {data && (
            data.pointTarget > 0 ? (
              <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-1">
                Target: {formatNumber(data.pointTarget)} poin
              </span>
            ) : (
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                Target belum diatur
              </span>
            )
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-400 text-center">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center p-16 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping mr-2" />
            Memuat papan poin...
          </div>
        ) : data && data.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-xs text-muted">
            Belum ada data poin untuk periode/outlet ini.
          </div>
        ) : data ? (
          <div className="space-y-2.5">
            {data.rows.map((row, idx) => {
              const pct = Math.min(100, Math.max(0, row.achievementPct));
              const hit = row.achievementPct >= 100 && data.pointTarget > 0;
              const expanded = expandedId === row.employeeId;
              return (
                <div key={row.employeeId} className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(row.employeeId)}
                    className="w-full p-4 flex items-center gap-4 text-left hover:bg-surface-hover/40 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 shrink-0 rounded-full border grid place-items-center text-xs font-bold ${
                        idx < 3 ? RANK_BADGE[idx] : "bg-surface-subtle text-muted border-border/70"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground truncate">{row.employeeName}</span>
                          {row.outlet && <span className="text-[11px] text-muted">{row.outlet}</span>}
                          <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                            className={`text-muted transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-mono font-bold text-foreground">{formatNumber(row.totalPoints)}</span>
                          {data.pointTarget > 0 ? (
                            <>
                              <span className="text-[11px] text-muted"> / {formatNumber(data.pointTarget)} poin</span>
                              <span className={`ml-2 text-[11px] font-bold ${hit ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}>
                                {row.achievementPct.toFixed(0)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-muted"> poin</span>
                          )}
                        </div>
                      </div>
                      {/* Without a target there's nothing to show progress against — a
                          0%-filled bar next to a real point count reads as "achieved
                          nothing", which is misleading, so the bar itself is skipped. */}
                      {data.pointTarget > 0 && (
                        <div className="h-2 rounded-full bg-surface-subtle overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${hit ? "bg-emerald-500" : "bg-accent"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {row.categoryBreakdown.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {row.categoryBreakdown.map((c) => (
                            <span
                              key={c.category}
                              className="text-[10px] font-medium text-muted bg-surface-subtle border border-border/60 rounded px-1.5 py-0.5"
                            >
                              {c.category} +{formatNumber(c.points)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border/60 bg-surface-subtle/40">
                      {breakdownLoading ? (
                        <div className="px-4 py-4 text-center text-[11px] text-muted">Memuat detail...</div>
                      ) : breakdown && breakdown.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border/60 text-left">
                                <th className="px-4 py-2 font-semibold text-[10px] uppercase text-muted">Nama Item</th>
                                <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase text-muted">Qty</th>
                                <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase text-muted">Poin / Pcs</th>
                                <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase text-muted">Subtotal Poin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {breakdown.map((item) => (
                                <tr key={item.itemId}>
                                  <td className="px-4 py-2 text-foreground">{item.itemName}</td>
                                  <td className="px-4 py-2 text-right font-mono text-muted">{formatNumber(item.qty)}</td>
                                  <td className="px-4 py-2 text-right font-mono text-muted">+{formatNumber(item.pointsPerUnit)}</td>
                                  <td className="px-4 py-2 text-right font-mono font-bold text-accent">{formatNumber(item.totalPoints)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-4 py-4 text-center text-[11px] text-muted">Tidak ada rincian item untuk periode ini.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
