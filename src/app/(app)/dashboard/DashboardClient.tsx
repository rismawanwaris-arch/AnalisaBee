"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
}

export function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAll = searchParams.get("all") === "1";
  const hasExplicitDate = Boolean(searchParams.get("from") || searchParams.get("to"));
  // No date param at all yet → default to yesterday–today, since that's the
  // range most days start with a report on. ?all=1 (from "Reset") opts out.
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
    fetch("/api/outlets")
      .then((r) => r.json())
      .then((list: OutletOption[]) => setOutlets(list));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urlFrom) params.set("from", urlFrom);
    if (urlTo) params.set("to", urlTo);
    if (urlOutlet) params.set("outletId", urlOutlet);
    const res = await fetch(`/api/dashboard?${params.toString()}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [urlFrom, urlTo, urlOutlet]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (outletId) params.set("outletId", outletId);
    router.push(`/dashboard?${params.toString()}`);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setOutletId("");
    router.push("/dashboard?all=1");
  }

  const hasFilters = Boolean(urlFrom || urlTo || urlOutlet);
  const neverImported = data ? data.totals.itemCount === 0 && data.totals.outletCount === 0 : false;

  if (!loading && data && neverImported) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-2">Belum ada data</h1>
        <p className="text-sm text-muted mb-4">
          Import file Excel penjualan pertama Anda untuk mulai melihat analisa.
        </p>
        <Link
          href="/import"
          className="inline-block rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Import Data
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            {showAll ? (
              "Ringkasan seluruh data penjualan."
            ) : (
              <>
                Menampilkan {formatDate(urlFrom || urlTo)}
                {urlFrom && urlTo && urlFrom !== urlTo ? ` – ${formatDate(urlTo)}` : ""}
                {!hasExplicitDate && " (default)"}.
              </>
            )}
          </p>
        </div>
        {data?.latestImport && (
          <p className="text-xs text-muted">
            Import terakhir: {data.latestImport.filename} · {formatDate(data.latestImport.uploadedAt)}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-end gap-3">
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
        <div>
          <label className="block text-xs text-muted mb-1">Outlet</label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm min-w-40"
          >
            <option value="">Semua Outlet</option>
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
          className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          Terapkan
        </button>
        {!showAll && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-muted hover:text-foreground underline"
          >
            Lihat Semua Data
          </button>
        )}
        {showAll && hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-muted hover:text-foreground underline"
          >
            Reset
          </button>
        )}
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted">Memuat data...</div>
      ) : data.totals.transactionCount === 0 ? (
        <div className="text-sm text-muted border border-dashed border-border rounded-lg p-8 text-center space-y-2">
          <p>Tidak ada data pada rentang ini.</p>
          {!showAll && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-accent underline text-sm"
            >
              Lihat semua data
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SparkKpiCard
              label="Total Qty Terjual"
              value={formatNumber(data.totals.qty)}
              trendPct={data.trendPct.qty}
              series={data.trend.map((t) => t.qty)}
            />
            <SparkKpiCard
              label="Total Omzet"
              value={formatRupiah(data.totals.subtotal)}
              trendPct={data.trendPct.subtotal}
              series={data.trend.map((t) => t.subtotal)}
            />
            <SparkKpiCard
              label="Total Laba"
              value={formatRupiah(data.totals.labaRugi)}
              trendPct={data.trendPct.labaRugi}
              series={data.trend.map((t) => t.labaRugi)}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Transaksi" value={formatNumber(data.totals.transactionCount)} />
            <StatCard label="Outlet" value={formatNumber(data.totals.outletCount)} />
            <StatCard label="Item" value={formatNumber(data.totals.itemCount)} />
            <StatCard label="Pegawai" value={formatNumber(data.totals.employeeCount)} />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <RevenueAreaChart data={data.trend} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Leaderboard
              title="Top 10 Item"
              rows={data.topItems.map((it) => ({
                id: it.itemId,
                href: `/items?id=${it.itemId}`,
                label: it.name,
                qty: it.qty,
                subtotal: it.subtotal,
              }))}
            />
            <Leaderboard
              title="Top 10 Outlet"
              rows={data.topOutlets.map((o) => ({
                id: o.outletId,
                href: `/outlets/${o.outletId}`,
                label: o.name,
                qty: o.qty,
                subtotal: o.subtotal,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
