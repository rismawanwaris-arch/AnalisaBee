"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ItemPicker, type ItemOption } from "@/components/ItemPicker";
import { StatCard } from "@/components/StatCard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { todayStr, yesterdayStr } from "@/lib/dateDefaults";

interface OutletOption {
  id: number;
  name: string;
}

interface EmployeeOption {
  id: number;
  name: string;
}

interface SaleRow {
  id: number;
  noTransaksi: string;
  tanggal: string;
  jamBuat: string;
  outletName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  hargaJual: number;
  subtotal: number;
  labaRugi: number;
  employeeName: string;
}

interface SalesResult {
  rows: SaleRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totals: { qty: number; subtotal: number; labaRugi: number };
}

// param key -> local state setter key, so load()/pushFilters()/exportCsv() all
// stay in sync with a single list instead of repeating every field by hand.
const RANGE_FIELDS = [
  "noTransaksi",
  "employeeId",
  "jamFrom",
  "jamTo",
  "qtyMin",
  "qtyMax",
  "subtotalMin",
  "subtotalMax",
  "labaRugiMin",
  "labaRugiMax",
] as const;
type RangeField = (typeof RANGE_FIELDS)[number];

export function TransactionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAll = searchParams.get("all") === "1";
  const hasExplicitDate = Boolean(searchParams.get("from") || searchParams.get("to"));
  const urlFrom = searchParams.get("from") ?? (showAll || hasExplicitDate ? "" : yesterdayStr());
  const urlTo = searchParams.get("to") ?? (showAll || hasExplicitDate ? "" : todayStr());
  const urlItemId = searchParams.get("itemId") ?? "";
  const urlOutletId = searchParams.get("outletId") ?? "";
  const urlPage = Number(searchParams.get("page")) || 1;
  const urlRange = Object.fromEntries(
    RANGE_FIELDS.map((f) => [f, searchParams.get(f) ?? ""])
  ) as Record<RangeField, string>;

  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);
  const [outletId, setOutletId] = useState(urlOutletId);
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [range, setRange] = useState<Record<RangeField, string>>(urlRange);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [data, setData] = useState<SalesResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/outlets")
      .then((r) => r.json())
      .then((list: OutletOption[]) => setOutlets(list));
    fetch("/api/employees")
      .then((r) => r.json())
      .then((list: EmployeeOption[]) =>
        setEmployees([...list].sort((a, b) => a.name.localeCompare(b.name)))
      );
  }, []);

  // hydrate the item picker from ?itemId= on first load / back-nav
  useEffect(() => {
    if (!urlItemId) {
      setSelectedItem(null);
      return;
    }
    if (selectedItem && String(selectedItem.id) === urlItemId) return;
    fetch(`/api/items/${urlItemId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.item) setSelectedItem(d.item);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlItemId]);

  function buildQuery(page: number) {
    const params = new URLSearchParams();
    if (urlFrom) params.set("from", urlFrom);
    if (urlTo) params.set("to", urlTo);
    if (urlItemId) params.set("itemId", urlItemId);
    if (urlOutletId) params.set("outletId", urlOutletId);
    RANGE_FIELDS.forEach((f) => {
      if (urlRange[f]) params.set(f, urlRange[f]);
    });
    if (page > 1) params.set("page", String(page));
    return params;
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/sales?${buildQuery(urlPage).toString()}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFrom, urlTo, urlItemId, urlOutletId, urlPage, JSON.stringify(urlRange)]);

  useEffect(() => {
    load();
  }, [load]);

  function pushFilters(page = 1) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (selectedItem) params.set("itemId", String(selectedItem.id));
    if (outletId) params.set("outletId", outletId);
    RANGE_FIELDS.forEach((f) => {
      if (range[f]) params.set(f, range[f]);
    });
    if (page > 1) params.set("page", String(page));
    router.push(`/transactions?${params.toString()}`);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setOutletId("");
    setSelectedItem(null);
    setRange(Object.fromEntries(RANGE_FIELDS.map((f) => [f, ""])) as Record<RangeField, string>);
    router.push("/transactions?all=1");
  }

  function exportCsv() {
    window.open(`/api/sales/export?${buildQuery(1).toString()}`, "_blank");
  }

  function setRangeField(field: RangeField, value: string) {
    setRange((r) => ({ ...r, [field]: value }));
  }

  const hasFilters = Boolean(
    urlFrom || urlTo || urlItemId || urlOutletId || RANGE_FIELDS.some((f) => urlRange[f])
  );
  const advancedActive = RANGE_FIELDS.filter(
    (f) => f !== "noTransaksi" && f !== "employeeId"
  ).some((f) => urlRange[f]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Data Penjualan</h1>
        <p className="text-sm text-muted mt-1">
          {showAll ? (
            "Semua transaksi hasil import, bisa difilter per tanggal, item, dan outlet."
          ) : (
            <>
              Menampilkan {formatDate(urlFrom || urlTo)}
              {urlFrom && urlTo && urlFrom !== urlTo ? ` – ${formatDate(urlTo)}` : ""}
              {!hasExplicitDate && " (default)"}.
            </>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
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
          <div className="w-40">
            <label className="block text-xs text-muted mb-1">No Transaksi</label>
            <input
              type="text"
              value={range.noTransaksi}
              onChange={(e) => setRangeField("noTransaksi", e.target.value)}
              placeholder="Cari no. transaksi"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="w-56">
            <label className="block text-xs text-muted mb-1">Item</label>
            <ItemPicker selected={selectedItem} onSelect={setSelectedItem} placeholder="Semua item" />
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
          <div>
            <label className="block text-xs text-muted mb-1">Pegawai</label>
            <select
              value={range.employeeId}
              onChange={(e) => setRangeField("employeeId", e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm min-w-40"
            >
              <option value="">Semua Pegawai</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm text-muted hover:text-foreground underline"
          >
            {showAdvanced ? "Sembunyikan" : "Filter Lanjutan (Jam, Qty, Subtotal, Laba/Rugi)"}
            {advancedActive && !showAdvanced && (
              <span className="ml-1 text-accent">· aktif</span>
            )}
          </button>
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-border">
            <RangePair
              label="Jam (HH:MM)"
              type="time"
              fromValue={range.jamFrom}
              toValue={range.jamTo}
              onFrom={(v) => setRangeField("jamFrom", v)}
              onTo={(v) => setRangeField("jamTo", v)}
            />
            <RangePair
              label="Qty"
              type="number"
              fromValue={range.qtyMin}
              toValue={range.qtyMax}
              onFrom={(v) => setRangeField("qtyMin", v)}
              onTo={(v) => setRangeField("qtyMax", v)}
            />
            <RangePair
              label="Subtotal (Rp)"
              type="number"
              fromValue={range.subtotalMin}
              toValue={range.subtotalMax}
              onFrom={(v) => setRangeField("subtotalMin", v)}
              onTo={(v) => setRangeField("subtotalMax", v)}
            />
            <RangePair
              label="Laba/Rugi (Rp)"
              type="number"
              fromValue={range.labaRugiMin}
              toValue={range.labaRugiMax}
              onFrom={(v) => setRangeField("labaRugiMin", v)}
              onTo={(v) => setRangeField("labaRugiMax", v)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => pushFilters(1)}
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
          <button
            type="button"
            onClick={exportCsv}
            className="ml-auto text-sm text-muted hover:text-foreground underline"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted">Memuat data...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Total Baris" value={formatNumber(data.total)} />
            <StatCard label="Total Qty" value={formatNumber(data.totals.qty)} />
            <StatCard label="Total Omzet" value={formatRupiah(data.totals.subtotal)} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">No Transaksi</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Tanggal</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Jam</th>
                  <th className="px-3 py-2 font-medium">Outlet</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                  <th className="px-3 py-2 font-medium text-right">Laba/Rugi</th>
                  <th className="px-3 py-2 font-medium">Pegawai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted">
                      Tidak ada data pada filter ini.
                    </td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{r.noTransaksi}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.tanggal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{r.jamBuat}</td>
                    <td className="px-3 py-2">{r.outletName}</td>
                    <td className="px-3 py-2 max-w-64 truncate" title={r.itemName}>
                      {r.itemName}
                    </td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.qty)}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(r.subtotal)}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(r.labaRugi)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.employeeName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > 0 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Halaman {data.page} dari {data.totalPages} · {formatNumber(data.total)} baris
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() => pushFilters(data.page - 1)}
                  className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={data.page >= data.totalPages}
                  onClick={() => pushFilters(data.page + 1)}
                  className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RangePair({
  label,
  type,
  fromValue,
  toValue,
  onFrom,
  onTo,
}: {
  label: string;
  type: "number" | "time";
  fromValue: string;
  toValue: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={fromValue}
          onChange={(e) => onFrom(e.target.value)}
          placeholder="Min"
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        <span className="text-muted text-xs">–</span>
        <input
          type={type}
          value={toValue}
          onChange={(e) => onTo(e.target.value)}
          placeholder="Maks"
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
