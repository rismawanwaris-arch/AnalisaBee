import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

export function TransactionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      .then((r) => (r.ok ? r.json() : []))
      .then((list: OutletOption[]) => setOutlets(list))
      .catch(() => {});
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: EmployeeOption[]) =>
        setEmployees([...list].sort((a, b) => a.name.localeCompare(b.name)))
      )
      .catch(() => {});
  }, []);

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
      })
      .catch(() => {});
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
    try {
      const res = await fetch(`/api/sales?${buildQuery(urlPage).toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
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
    navigate(`/transactions?${params.toString()}`);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setOutletId("");
    setSelectedItem(null);
    setRange(Object.fromEntries(RANGE_FIELDS.map((f) => [f, ""])) as Record<RangeField, string>);
    navigate("/transactions?all=1");
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
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Audit &amp; Data Penjualan</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          {showAll ? (
            "Menampilkan seluruh baris data transaksi penjualan POS hasil import tanpa batasan tanggal."
          ) : (
            <>
              Rentang: <strong className="text-foreground">{formatDate(urlFrom || urlTo)}</strong>
              {urlFrom && urlTo && urlFrom !== urlTo ? ` – ${formatDate(urlTo)}` : ""}
              {!hasExplicitDate && " (default)"}.
            </>
          )}
        </p>
      </div>

      {/* Filter Control Card */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
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
          <div className="w-44">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              No Transaksi
            </label>
            <input
              type="text"
              value={range.noTransaksi}
              onChange={(e) => setRangeField("noTransaksi", e.target.value)}
              placeholder="Cari no. invoice/struk..."
              className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="w-60">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Filter Item
            </label>
            <ItemPicker selected={selectedItem} onSelect={setSelectedItem} placeholder="Semua item..." />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Filter Outlet
            </label>
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground min-w-40 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Filter Pegawai
            </label>
            <select
              value={range.employeeId}
              onChange={(e) => setRangeField("employeeId", e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground min-w-40 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <span>{showAdvanced ? "▲ Sembunyikan Filter Lanjutan" : "▼ Filter Lanjutan (Jam, Qty, Nominal, Laba/Rugi)"}</span>
            {advancedActive && !showAdvanced && (
              <span className="bg-accent/15 text-accent text-[10px] px-1.5 py-0.2 rounded font-bold">aktif</span>
            )}
          </button>
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-border/60">
            <RangePair
              label="Rentang Jam"
              type="time"
              fromValue={range.jamFrom}
              toValue={range.jamTo}
              onFrom={(v) => setRangeField("jamFrom", v)}
              onTo={(v) => setRangeField("jamTo", v)}
            />
            <RangePair
              label="Qty (pcs)"
              type="number"
              fromValue={range.qtyMin}
              toValue={range.qtyMax}
              onFrom={(v) => setRangeField("qtyMin", v)}
              onTo={(v) => setRangeField("qtyMax", v)}
            />
            <RangePair
              label="Omzet / Subtotal (Rp)"
              type="number"
              fromValue={range.subtotalMin}
              toValue={range.subtotalMax}
              onFrom={(v) => setRangeField("subtotalMin", v)}
              onTo={(v) => setRangeField("subtotalMax", v)}
            />
            <RangePair
              label="Laba / Rugi (Rp)"
              type="number"
              fromValue={range.labaRugiMin}
              toValue={range.labaRugiMax}
              onFrom={(v) => setRangeField("labaRugiMin", v)}
              onTo={(v) => setRangeField("labaRugiMax", v)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pushFilters(1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Terapkan Filter</span>
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
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data || data.total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover disabled:opacity-40 transition-colors shadow-xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center p-12 text-xs text-muted font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>Memuat data transaksi...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <StatCard label="Total Baris" value={formatNumber(data.total)} />
            <StatCard label="Total Kuantitas" value={`${formatNumber(data.totals.qty)} pcs`} />
            <StatCard label="Total Laba" value={formatRupiah(data.totals.labaRugi)} />
            <StatCard label="Total Omzet" value={formatRupiah(data.totals.subtotal)} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase whitespace-nowrap">No Transaksi</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase whitespace-nowrap">Tanggal</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase whitespace-nowrap">Jam</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Outlet</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Nama Item</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase text-right">Qty</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase text-right">Subtotal</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase text-right">Laba/Rugi</th>
                  <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Pegawai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted">
                      Tidak ada data transaksi yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-hover/70 transition-colors">
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-foreground/80">{r.noTransaksi}</td>
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-muted">{formatDate(r.tanggal)}</td>
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-muted">{r.jamBuat}</td>
                    <td className="px-3.5 py-2 font-medium text-foreground">{r.outletName}</td>
                    <td className="px-3.5 py-2 max-w-64 truncate text-foreground" title={r.itemName}>
                      {r.itemName}
                    </td>
                    <td className="px-3.5 py-2 font-mono text-right text-foreground">{formatNumber(r.qty)}</td>
                    <td className="px-3.5 py-2 font-mono text-right text-foreground font-semibold">{formatRupiah(r.subtotal)}</td>
                    <td className="px-3.5 py-2 font-mono text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatRupiah(r.labaRugi)}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-foreground/80">{r.employeeName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > 0 && (
            <div className="flex items-center justify-between text-xs text-muted px-1">
              <span>
                Halaman <strong className="text-foreground">{data.page}</strong> dari {data.totalPages} · <strong className="text-foreground">{formatNumber(data.total)}</strong> baris total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() => pushFilters(data.page - 1)}
                  className="rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-hover disabled:opacity-40 transition-colors shadow-2xs"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={data.page >= data.totalPages}
                  onClick={() => pushFilters(data.page + 1)}
                  className="rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-hover disabled:opacity-40 transition-colors shadow-2xs"
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
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={fromValue}
          onChange={(e) => onFrom(e.target.value)}
          placeholder="Min"
          className="w-24 rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
        <span className="text-muted text-xs">–</span>
        <input
          type={type}
          value={toValue}
          onChange={(e) => onTo(e.target.value)}
          placeholder="Maks"
          className="w-24 rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
      </div>
    </div>
  );
}
