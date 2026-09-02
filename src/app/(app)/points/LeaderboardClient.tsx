"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export function LeaderboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    const res = await fetch(`/api/points/leaderboard?${queryParams().toString()}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
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
    router.push(`/points?${params.toString()}`);
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
    const res = await fetch(`/api/points/employee/${employeeId}?${queryParams().toString()}`);
    if (res.ok) setBreakdown(await res.json());
    setBreakdownLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="inline-flex rounded-md border border-border p-0.5 bg-background">
          {(["day", "month", "range"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === m ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {mode === "day" && (
            <div>
              <label className="block text-xs text-muted mb-1">Tanggal</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          )}
          {mode === "month" && (
            <div>
              <label className="block text-xs text-muted mb-1">Bulan</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          )}
          {mode === "range" && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1">Dari tanggal</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Sampai tanggal</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Tampilkan
          </button>
          {data && (
            <span className="text-sm text-muted">
              Periode: {formatDate(data.from)} – {formatDate(data.to)}
            </span>
          )}
        </div>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted">Memuat...</div>
      ) : data.rows.length === 0 ? (
        <div className="text-sm text-muted border border-dashed border-border rounded-lg p-8 text-center">
          Belum ada poin untuk periode ini.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium w-12">#</th>
                <th className="px-4 py-2 font-medium">Pegawai</th>
                <th className="px-4 py-2 font-medium text-right">Qty Item Berpoin</th>
                <th className="px-4 py-2 font-medium text-right">Total Poin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r, idx) => (
                <Fragment key={r.employeeId}>
                  <tr
                    onClick={() => toggleExpand(r.employeeId)}
                    className="cursor-pointer hover:bg-surface-hover"
                  >
                    <td className="px-4 py-2 text-muted tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium">{r.employeeName}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.pointItemsQty)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-accent">
                      {formatNumber(r.totalPoints)}
                    </td>
                  </tr>
                  {expandedId === r.employeeId && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 bg-background">
                        {breakdownLoading ? (
                          <div className="text-sm text-muted">Memuat rincian...</div>
                        ) : breakdown && breakdown.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-muted text-left">
                                <tr>
                                  <th className="px-2 py-1 font-medium">Item</th>
                                  <th className="px-2 py-1 font-medium text-right">Qty</th>
                                  <th className="px-2 py-1 font-medium text-right">Poin/pcs</th>
                                  <th className="px-2 py-1 font-medium text-right">Total Poin</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {breakdown.map((b) => (
                                  <tr key={b.itemId}>
                                    <td className="px-2 py-1">{b.itemName}</td>
                                    <td className="px-2 py-1 text-right">{formatNumber(b.qty)}</td>
                                    <td className="px-2 py-1 text-right">{b.pointsPerUnit}</td>
                                    <td className="px-2 py-1 text-right">
                                      {formatNumber(b.totalPoints)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-muted">Tidak ada rincian.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
