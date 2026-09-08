import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatNumber, formatDate } from "@/lib/format";
import { usePointsSettings } from "@/hooks/usePointsSettings";

interface LeaderboardRow {
  employeeId: number;
  employeeName: string;
  totalPoints: number;
  pointItemsQty: number;
}
interface LeaderboardResponse {
  rows: LeaderboardRow[];
  from: string;
  to: string;
}
interface BreakdownRow {
  itemId: number;
  itemName: string;
  itemGroup: string | null;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
}

type Mode = "day" | "month" | "range";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// A period labeled "month M" runs from periodStartDay of M through
// periodStartDay-1 of M+1 (see computeMonthPeriod on the server). So if
// today falls before periodStartDay, the period actually running right now
// started last month, not this one — e.g. periodStartDay=29 and today the
// 6th means the running period is still "last month" (29th – 28th).
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

const MODE_LABEL: Record<Mode, string> = { day: "Per Hari", month: "Per Bulan", range: "Per Rentang" };

export function PointsLeaderboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Default to 1 (plain calendar month) until the real cut-off day loads —
  // matches prior behavior for the common case and self-corrects below once
  // periodStartDay is known.
  const { data: settings } = usePointsSettings();
  const periodStartDay = settings?.periodStartDay ?? 1;

  const urlMode = (searchParams.get("mode") as Mode) || "month";
  const urlDay = searchParams.get("day") || todayStr();
  const urlMonth = searchParams.get("month") || currentPeriodMonthStr(periodStartDay);
  const urlFrom = searchParams.get("from") || todayStr();
  const urlTo = searchParams.get("to") || todayStr();

  const [mode, setMode] = useState<Mode>(urlMode);
  const [day, setDay] = useState(urlDay);
  const [month, setMonth] = useState(urlMonth);
  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);

  // Once the real cut-off day is known, correct the "Pilih Bulan" field if
  // the user hasn't explicitly picked a month (via typing or a shared URL).
  useEffect(() => {
    if (searchParams.get("month")) return;
    setMonth(currentPeriodMonthStr(periodStartDay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStartDay]);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const queryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (urlMode === "day") {
      params.set("from", urlDay);
      params.set("to", urlDay);
    } else if (urlMode === "range") {
      params.set("from", urlFrom);
      params.set("to", urlTo);
    } else {
      const [y, m] = urlMonth.split("-").map(Number);
      params.set("year", String(y));
      params.set("month", String(m));
    }
    return params;
  }, [urlMode, urlDay, urlFrom, urlTo, urlMonth]);

  // React Query keys off the resolved period params directly, so switching
  // mode/date and switching back to a period already seen this session
  // renders instantly from cache instead of refetching. It also replaces the
  // manual "ignore stale in-flight response" guard the old fetch() version
  // needed — React Query already discards a response if its query key is no
  // longer the active one by the time it resolves.
  const periodKey = queryParams().toString();
  const { data, isLoading: loading } = useQuery({
    queryKey: ["points-leaderboard", periodKey],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const res = await fetch(`/api/points/leaderboard?${periodKey}`);
      if (!res.ok) throw new Error("Gagal memuat leaderboard.");
      return res.json();
    },
  });

  // Collapse any expanded row when the period filter changes — matches the
  // old behavior (a breakdown for a different period would be misleading).
  useEffect(() => {
    setExpandedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["points-employee-breakdown", expandedId, periodKey],
    queryFn: async (): Promise<BreakdownRow[]> => {
      const res = await fetch(`/api/points/employee/${expandedId}?${periodKey}`);
      if (!res.ok) throw new Error("Gagal memuat rincian.");
      return res.json();
    },
    enabled: expandedId !== null,
  });

  function applyFilters() {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (mode === "day") params.set("day", day);
    else if (mode === "range") {
      params.set("from", from);
      params.set("to", to);
    } else params.set("month", month);
    navigate(`/points?${params.toString()}`);
  }

  function toggleExpand(employeeId: number) {
    setExpandedId((current) => (current === employeeId ? null : employeeId));
  }

  return (
    <div className="space-y-4">
      {/* Control Card */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 space-y-3.5 shadow-xs">
        <div className="inline-flex rounded-lg border border-border/80 p-1 bg-surface-subtle shadow-2xs">
          {(["day", "month", "range"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                mode === m
                  ? "bg-surface text-foreground shadow-xs border border-border/60"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-1">
          {mode === "day" && (
            <div>
              <label htmlFor="points-leaderboard-day" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Pilih Tanggal
              </label>
              <input
                id="points-leaderboard-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
          )}
          {mode === "month" && (
            <div>
              <label htmlFor="points-leaderboard-month" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Pilih Bulan
              </label>
              <input
                id="points-leaderboard-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
          )}
          {mode === "range" && (
            <>
              <div>
                <label htmlFor="points-leaderboard-from" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Dari Tanggal
                </label>
                <input
                  id="points-leaderboard-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label htmlFor="points-leaderboard-to" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Sampai Tanggal
                </label>
                <input
                  id="points-leaderboard-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Tampilkan</span>
          </button>
          {data && (
            <span className="text-xs text-muted font-medium ml-1">
              Periode: <strong className="text-foreground">{formatDate(data.from)}</strong> – <strong className="text-foreground">{formatDate(data.to)}</strong>
            </span>
          )}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center p-12 text-xs text-muted font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>Memuat data leaderboard...</span>
          </div>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted font-medium">
          Belum ada akumulasi poin pegawai untuk periode yang dipilih.
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase w-12">#</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Pegawai</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Qty Item Berpoin</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Poin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.rows.map((r, idx) => {
                const rank = idx + 1;
                const isExpanded = expandedId === r.employeeId;

                return (
                  <Fragment key={r.employeeId}>
                    <tr
                      onClick={() => toggleExpand(r.employeeId)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded ? "bg-accent/5" : "hover:bg-surface-hover/70"
                      }`}
                    >
                      <td className="px-4 py-3 text-muted tabular-nums">
                        <span
                          className={`w-5 h-5 rounded-md grid place-items-center text-[10px] font-bold font-mono ${
                            rank === 1
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : rank === 2
                              ? "bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30"
                              : rank === 3
                              ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                              : "bg-surface-subtle text-muted"
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                        <span>{r.employeeName}</span>
                        <span className="text-[10px] text-muted font-normal">
                          {isExpanded ? "▲ tutup" : "▼ rincian"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground font-medium">
                        {formatNumber(r.pointItemsQty)} pcs
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-accent">
                        {formatNumber(r.totalPoints)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 bg-surface-subtle/50 border-y border-border/60">
                          {breakdownLoading ? (
                            <div className="text-xs text-muted font-medium py-2">Memuat rincian item berpoin...</div>
                          ) : breakdown && breakdown.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border border-border/80 bg-surface shadow-2xs">
                              <table className="w-full text-xs">
                                <thead className="bg-surface-subtle/60 text-muted text-left border-b border-border/70">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold text-[11px] uppercase">Nama Item</th>
                                    <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Qty</th>
                                    <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Poin / pcs</th>
                                    <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Subtotal Poin</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 font-mono">
                                  {breakdown.map((b) => (
                                    <tr key={b.itemId} className="hover:bg-surface-hover/50 transition-colors">
                                      <td className="px-3 py-2 font-sans font-medium text-foreground">{b.itemName}</td>
                                      <td className="px-3 py-2 text-right text-foreground">{formatNumber(b.qty)}</td>
                                      <td className="px-3 py-2 text-right text-muted">+{b.pointsPerUnit}</td>
                                      <td className="px-3 py-2 text-right font-bold text-accent">
                                        {formatNumber(b.totalPoints)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-xs text-muted py-2">Tidak ada rincian item untuk periode ini.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
