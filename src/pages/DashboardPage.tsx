import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { SparkKpiCard } from "@/components/SparkKpiCard";
import { RevenueAreaChart } from "@/components/RevenueAreaChart";
import { Leaderboard } from "@/components/Leaderboard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { todayStr, yesterdayStr } from "@/lib/dateDefaults";
import { useOutlets } from "@/hooks/useOutlets";

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
  trend: { tanggal: string; qty: number; subtotal: number; labaRugi: number; laporanHarianTotal: number }[];
  topItems: { itemId: number; code: string; name: string; qty: number; subtotal: number }[];
  topOutlets: { outletId: number; name: string; qty: number; subtotal: number }[];
  latestImport: { filename: string; uploadedAt: string; status: string } | null;
  labaTargetPerDay: number | null;
  laporanTargetPerDay: number | null;
}

interface DashboardPageProps {
  branch?: "BANDUNG" | "CIMAHI";
}

export function DashboardPage({ branch = "BANDUNG" }: DashboardPageProps) {
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
  const { data: outlets = [] } = useOutlets(branch);
  const basePath = branch === "CIMAHI" ? "/cimahi/dashboard" : "/dashboard";

  const { data, isLoading: loading } = useQuery({
    queryKey: ["dashboard", branch, urlFrom, urlTo, urlOutlet],
    queryFn: async (): Promise<DashboardData> => {
      const params = new URLSearchParams();
      params.set("branch", branch);
      if (urlFrom) params.set("from", urlFrom);
      if (urlTo) params.set("to", urlTo);
      if (urlOutlet) params.set("outletId", urlOutlet);
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat ringkasan dashboard.");
      return res.json();
    },
  });

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
    navigate(`${basePath}?${params.toString()}`);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setOutletId("");
    navigate(`${basePath}?all=1`);
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
      <div className="animate-enter flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Ringkasan Eksekutif{branch === "CIMAHI" ? " — Cimahi" : ""}
          </h1>
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
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>
              Import terakhir: <strong className="text-foreground font-medium">{data.latestImport.filename}</strong> · {formatDate(data.latestImport.uploadedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Control Filter Bar */}
      <div
        style={{ animationDelay: "50ms" }}
        className="animate-enter rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs flex flex-wrap items-end gap-3"
      >
        <div>
          <label htmlFor="dashboard-from" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Dari Tanggal
          </label>
          <input
            id="dashboard-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <div>
          <label htmlFor="dashboard-to" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Sampai Tanggal
          </label>
          <input
            id="dashboard-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <div>
          <label htmlFor="dashboard-outlet" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Filter Outlet
          </label>
          <select
            id="dashboard-outlet"
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/70 bg-surface p-4 shadow-xs space-y-3 animate-pulse"
              >
                <div className="h-3 w-24 rounded bg-surface-subtle" />
                <div className="h-7 w-32 rounded bg-surface-subtle" />
                <div className="h-3 w-20 rounded bg-surface-subtle" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/70 bg-surface p-5 shadow-xs space-y-3 animate-pulse">
            <div className="h-4 w-44 rounded bg-surface-subtle" />
            <div className="h-64 w-full rounded-xl bg-surface-subtle/60" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/70 bg-surface p-4 shadow-xs space-y-3 animate-pulse"
              >
                <div className="h-4 w-40 rounded bg-surface-subtle" />
                <div className="space-y-2.5">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-8 rounded-lg bg-surface-subtle/60" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : data.totals.transactionCount === 0 && data.trend.length === 0 ? (
        <div className="animate-enter rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center space-y-2">
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
        <div key={`${branch}:${urlFrom}:${urlTo}:${urlOutlet}`} className="space-y-4">
          {/* KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            <SparkKpiCard
              label="Total Omzet"
              value={formatRupiah(data.totals.subtotal)}
              numericValue={data.totals.subtotal}
              formatValue={(n) => formatRupiah(n)}
              trendPct={data.trendPct.subtotal}
              series={data.trend.map((t) => t.subtotal)}
              hint={`${formatNumber(data.totals.transactionCount)} transaksi`}
              delayMs={0}
            />
            <SparkKpiCard
              label="Total Laba"
              value={formatRupiah(data.totals.labaRugi)}
              numericValue={data.totals.labaRugi}
              formatValue={(n) => formatRupiah(n)}
              trendPct={data.trendPct.labaRugi}
              series={data.trend.map((t) => t.labaRugi)}
              hint={
                data.totals.subtotal > 0
                  ? `Margin ${((data.totals.labaRugi / data.totals.subtotal) * 100).toFixed(1)}%`
                  : undefined
              }
              delayMs={60}
            />
            <SparkKpiCard
              label="Qty Terjual"
              value={`${formatNumber(data.totals.qty)} pcs`}
              numericValue={data.totals.qty}
              formatValue={(n) => `${formatNumber(n)} pcs`}
              trendPct={data.trendPct.qty}
              series={data.trend.map((t) => t.qty)}
              hint={
                data.totals.outletCount > 0
                  ? `${formatNumber(
                      Math.round(data.totals.qty / data.totals.outletCount)
                    )} pcs/outlet`
                  : undefined
              }
              delayMs={120}
            />
            <StatCard
              label="Outlet Aktif"
              value={formatNumber(data.totals.outletCount)}
              numericValue={data.totals.outletCount}
              formatValue={(n) => formatNumber(n)}
              hint={`${formatNumber(data.totals.itemCount)} item terjual`}
              delayMs={180}
            />
            <StatCard
              label="Pegawai Aktif"
              value={formatNumber(data.totals.employeeCount)}
              numericValue={data.totals.employeeCount}
              formatValue={(n) => formatNumber(n)}
              hint={
                data.totals.employeeCount > 0
                  ? `${formatRupiah(
                      Math.round(data.totals.subtotal / data.totals.employeeCount)
                    )}/orang`
                  : undefined
              }
              delayMs={240}
            />
          </div>

          {/* Area Chart Section */}
          <div
            style={{ animationDelay: "280ms" }}
            className="animate-enter rounded-xl border border-border/80 bg-surface p-5 shadow-xs"
          >
            <RevenueAreaChart
              data={data.trend}
              labaTargetPerDay={data.labaTargetPerDay}
              laporanTargetPerDay={data.laporanTargetPerDay}
            />
          </div>

          {/* Leaderboards */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Leaderboard
              title="Top 10 Item Terlaris"
              delayMs={340}
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
              delayMs={420}
              rows={data.topOutlets.map((outlet) => ({
                id: outlet.outletId,
                href: `/outlets/${outlet.outletId}`,
                label: outlet.name,
                qty: outlet.qty,
                subtotal: outlet.subtotal,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
