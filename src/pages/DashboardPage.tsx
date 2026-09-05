import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { SparkKpiCard } from "@/components/SparkKpiCard";
import { RevenueAreaChart } from "@/components/RevenueAreaChart";
import { Leaderboard } from "@/components/Leaderboard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { todayStr, yesterdayStr } from "@/lib/dateDefaults";

interface OutletOption {
  id: number;
  name: string;
}

interface DashboardData {
  totals: {
    qty: number;
    subtotal: number;
    labaRugi: number;
    transactionCount: number;
    outletCount: number;
    itemCount: number;
    employeeCount: number;
  };
  trendPct: { qty: number | null; subtotal: number | null; labaRugi: number | null };
  trend: { tanggal: string; qty: number; subtotal: number; labaRugi: number }[];
  topItems: { itemId: number; code: string; name: string; qty: number; subtotal: number }[];
  topOutlets: { outletId: number; name: string; qty: number; subtotal: number }[];
  latestImport: { filename: string; uploadedAt: string; status: string } | null;
  labaTargetPerDay: number | null;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showAll = searchParams.get("all") === "1";
  const hasExplicitDate = Boolean(searchParams.get("from") || searchParams.get("to"));
  const urlFrom = searchParams.get("from") ?? (showAll || hasExplicitDate ? "" : yesterdayStr());
  const urlTo = searchParams.get("to") ?? (showAll || hasExplicitDate ? "" : todayStr());
  const urlOutlet = searchParams.get("outletId") ?? "";

  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);
  const [outletId, setOutletId] = useState(urlOutlet);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/outlets", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: OutletOption[]) => setOutlets(list))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urlFrom) params.set("from", urlFrom);
    if (urlTo) params.set("to", urlTo);
    if (urlOutlet) params.set("outletId", urlOutlet);
    try {
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [urlFrom, urlTo, urlOutlet]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFrom(urlFrom);
    setTo(urlTo);
    setOutletId(urlOutlet);
  }, [urlFrom, urlTo, urlOutlet]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (outletId) params.set("outletId", outletId);
    navigate(`/dashboard?${params.toString()}`);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setOutletId("");
    navigate("/dashboard?all=1");
  }

  const hasFilters = Boolean(urlFrom || urlTo || urlOutlet);
  const neverImported = data ? data.totals.itemCount === 0 && data.totals.outletCount === 0 : false;

  if (!loading && data && neverImported) {
    return (
      <div className="rounded-2xl border border-border/80 bg-surface p-12 text-center shadow-xs max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent grid place-items-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
          </svg>
        </div>
        <h1 className="text-base font-bold text-foreground mb-1.5">Belum Ada Data Penjualan</h1>
        <p className="text-xs text-muted mb-6 leading-relaxed">
          Import file Excel penjualan POS (.xls / .xlsx) pertama Anda untuk mulai melihat ringkasan omzet, laba, dan performa outlet.
        </p>
        <Link
          to="/import"
          className="inline-flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-2.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-sm"
        >
          <span>Mulai Import Data</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Ringkasan Eksekutif</h1>
          <p className="text-xs text-muted mt-0.5">
            {showAll ? (
              "Menampilkan agregasi seluruh data penjualan tanpa batas rentang."
            ) : (
              <>
                Rentang: <span className="font-medium text-foreground">{formatDate(urlFrom || urlTo)}</span>
                {urlFrom && urlTo && urlFrom !== urlTo ? ` – ${formatDate(urlTo)}` : ""}
                {!hasExplicitDate && " (default hari ini/kemarin)"}.
              </>
            )}
          </p>
        </div>
        {data?.latestImport && (
          <div className="inline-flex items-center gap-2 text-[11px] text-muted bg-surface border border-border/80 rounded-lg px-3 py-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>
              Import terakhir: <strong className="text-foreground font-medium">{data.latestImport.filename}</strong> · {formatDate(data.latestImport.uploadedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Control Filter Bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Dari Tanggal
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
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
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Filter Outlet
          </label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground min-w-44 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          >
            <option value="">Semua Outlet ({outlets.length})</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Terapkan</span>
        </button>
        {!showAll && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-medium text-muted hover:text-foreground underline underline-offset-4 px-2 py-1.5 transition-colors"
          >
            Lihat Semua Data
          </button>
        )}
        {showAll && hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-medium text-muted hover:text-foreground underline underline-offset-4 px-2 py-1.5 transition-colors"
          >
            Reset Filter
          </button>
        )}
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center p-12 text-xs text-muted font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>Memuat ringkasan data...</span>
          </div>
        </div>
      ) : data.totals.transactionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center space-y-2">
          <p className="text-xs text-muted font-medium">Tidak ada transaksi ditemukan pada rentang filter ini.</p>
          {!showAll && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-accent underline text-xs font-semibold hover:opacity-80"
            >
              Lihat semua data yang tersimpan
            </button>
          )}
        </div>
      ) : (
        <>
          {/* KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            <SparkKpiCard
              label="Total Omzet"
              value={formatRupiah(data.totals.subtotal)}
              trendPct={data.trendPct.subtotal}
              series={data.trend.map((t) => t.subtotal)}
              hint={`${formatNumber(data.totals.transactionCount)} transaksi`}
            />
            <SparkKpiCard
              label="Total Laba"
              value={formatRupiah(data.totals.labaRugi)}
              trendPct={data.trendPct.labaRugi}
              series={data.trend.map((t) => t.labaRugi)}
              hint={
                data.totals.subtotal > 0
                  ? `Margin ${((data.totals.labaRugi / data.totals.subtotal) * 100).toFixed(1)}%`
                  : undefined
              }
            />
            <SparkKpiCard
              label="Qty Terjual"
              value={`${formatNumber(data.totals.qty)} pcs`}
              trendPct={data.trendPct.qty}
              series={data.trend.map((t) => t.qty)}
              hint={
                data.totals.outletCount > 0
                  ? `${formatNumber(
                      Math.round(data.totals.qty / data.totals.outletCount)
                    )} pcs/outlet`
                  : undefined
              }
            />
            <StatCard
              label="Outlet Aktif"
              value={formatNumber(data.totals.outletCount)}
              hint={`${formatNumber(data.totals.itemCount)} item terjual`}
            />
            <StatCard
              label="Pegawai Aktif"
              value={formatNumber(data.totals.employeeCount)}
              hint={
                data.totals.employeeCount > 0
                  ? `${formatRupiah(
                      Math.round(data.totals.subtotal / data.totals.employeeCount)
                    )}/orang`
                  : undefined
              }
            />
          </div>

          {/* Area Chart Section */}
          <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
            <RevenueAreaChart data={data.trend} labaTargetPerDay={data.labaTargetPerDay} />
          </div>

          {/* Leaderboards */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Leaderboard
              title="Top 10 Item Terlaris"
              rows={data.topItems.map((item) => ({
                id: item.itemId,
                href: `/items/${item.itemId}`,
                label: item.name,
                qty: item.qty,
                subtotal: item.subtotal,
              }))}
            />
            <Leaderboard
              title="Top 10 Outlet Terbaik"
              rows={data.topOutlets.map((outlet) => ({
                id: outlet.outletId,
                href: `/outlets/${outlet.outletId}`,
                label: outlet.name,
                qty: outlet.qty,
                subtotal: outlet.subtotal,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
