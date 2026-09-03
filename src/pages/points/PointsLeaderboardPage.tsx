import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatNumber, formatDate } from "@/lib/format";

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
function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MODE_LABEL: Record<Mode, string> = { day: "Per Hari", month: "Per Bulan", range: "Per Rentang" };

export function PointsLeaderboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlMode = (searchParams.get("mode") as Mode) || "month";
  const urlDay = searchParams.get("day") || todayStr();
  const urlMonth = searchParams.get("month") || currentMonthStr();
  const urlFrom = searchParams.get("from") || todayStr();
  const urlTo = searchParams.get("to") || todayStr();

  const [mode, setMode] = useState<Mode>(urlMode);
  const [day, setDay] = useState(urlDay);
  const [month, setMonth] = useState(urlMonth);
  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[] | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/points/leaderboard?${queryParams().toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    load();
    setExpandedId(null);
    setBreakdown(null);
  }, [load]);

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
      const res = await fetch(`/api/points/employee/${employeeId}?${queryParams().toString()}`);
      if (res.ok) setBreakdown(await res.json());
    } catch {
      // ignore
    } finally {
      setBreakdownLoading(false);
    }
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
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Pilih Tanggal
              </label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
          )}
          {mode === "month" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Pilih Bulan
              </label>
              <input
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
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Sampai Tanggal
                </label>
                <input
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
