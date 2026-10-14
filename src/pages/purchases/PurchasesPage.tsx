import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { PurchaseBatchHistory, type PurchaseBatchHistoryHandle } from "@/components/PurchaseBatchHistory";

interface PurchaseKpiSummary {
  totalSpend: number;
  invoiceCount: number;
  vendorCount: number;
  totalQty: number;
  distinctItemCount: number;
}

interface VendorSummaryRow {
  vendor: string;
  invoiceCount: number;
  totalSpend: number;
  totalQty: number;
  distinctItemCount: number;
  avgPerInvoice: number;
  percentage: number;
}

interface PurchaseInvoiceListItem {
  id: number;
  invoiceNumber: string;
  date: string;
  vendor: string;
  outletName: string;
  currency: string;
  itemCount: number;
  totalQty: number;
  subtotal: number;
  discount: number;
  tax: number;
  otherFee: number;
  total: number;
}

interface PurchaseInvoiceDetailItem {
  id: number;
  itemSeq: number | null;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  price: number;
  discount: number;
  tax: number;
  subtotal: number;
}

interface PurchaseInvoiceDetail {
  id: number;
  invoiceNumber: string;
  date: string;
  refInvoice: string | null;
  outletName: string;
  vendor: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  otherFee: number;
  total: number;
  items: PurchaseInvoiceDetailItem[];
}

interface TopPurchasedItemRow {
  itemCode: string;
  itemName: string;
  vendor: string;
  totalQty: number;
  totalSpend: number;
  avgPrice: number;
}

export function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<"vendors" | "invoices" | "items">("vendors");

  // Date Filters
  const [datePreset, setDatePreset] = useState<"this_month" | "last_month" | "all" | "custom">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Select Filters
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Options
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [outletOptions, setOutletOptions] = useState<string[]>([]);

  // Data states
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PurchaseKpiSummary | null>(null);
  const [vendorRows, setVendorRows] = useState<VendorSummaryRow[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoiceListItem[]>([]);
  const [topItems, setTopItems] = useState<TopPurchasedItemRow[]>([]);

  // Invoice Detail Modal
  const [activeInvoiceDetail, setActiveInvoiceDetail] = useState<PurchaseInvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<"file" | "paste">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const historyRef = useRef<PurchaseBatchHistoryHandle>(null);

  // Quick Date Presets
  function applyDatePreset(preset: "this_month" | "last_month" | "all" | "custom") {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
    } else if (preset === "this_month") {
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(end.toISOString().slice(0, 10));
    } else if (preset === "last_month") {
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(end.toISOString().slice(0, 10));
    }
  }

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (selectedVendor) params.set("vendor", selectedVendor);
    if (selectedOutlet) params.set("outlet", selectedOutlet);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    return params.toString();
  }, [fromDate, toDate, selectedVendor, selectedOutlet, searchQuery]);

  // Load filter options
  const loadOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/purchases/options");
      if (res.ok) {
        const data = await res.json();
        setVendorOptions(data.vendors || []);
        setOutletOptions(data.outlets || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load dashboard data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, venRes, invRes, itemRes] = await Promise.all([
        fetch(`/api/purchases/summary?${queryString}`),
        fetch(`/api/purchases/vendors?${queryString}`),
        fetch(`/api/purchases/invoices?${queryString}&pageSize=100`),
        fetch(`/api/purchases/top-items?${queryString}&limit=30`),
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (venRes.ok) setVendorRows(await venRes.json());
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.rows || []);
      }
      if (itemRes.ok) setTopItems(await itemRes.json());
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open invoice detail modal
  async function openInvoiceDetail(idOrNumber: number | string) {
    setDetailLoading(true);
    setActiveInvoiceDetail(null);
    try {
      const res = await fetch(`/api/purchases/invoices/${encodeURIComponent(idOrNumber)}`);
      if (res.ok) {
        setActiveInvoiceDetail(await res.json());
      } else {
        alert("Gagal memuat detail nota pembelian.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setDetailLoading(false);
    }
  }

  // Handle Import Submit
  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setImportBusy(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      let res: Response;
      if (importTab === "file") {
        if (!importFile) {
          setImportError("Pilih file Excel/CSV terlebih dahulu.");
          setImportBusy(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", importFile);
        res = await fetch("/api/purchases/import", { method: "POST", body: fd });
      } else {
        if (!importText.trim()) {
          setImportError("Salin dan tempel data CSV/teks terlebih dahulu.");
          setImportBusy(false);
          return;
        }
        res = await fetch("/api/purchases/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: importText }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Gagal memproses import data.");
      } else {
        const periode =
          data.periodStart && data.periodEnd
            ? data.periodStart === data.periodEnd
              ? ` Periode: ${formatDate(data.periodStart)}.`
              : ` Periode: ${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}.`
            : "";
        setImportSuccess(
          `✓ Berhasil mengimpor ${data.totalInvoices} nota (${data.insertedInvoices} baru, ${data.updatedInvoices} diperbarui; ${data.totalItems} baris barang). Total belanja: ${formatRupiah(data.totalSpend)}.${periode}`
        );
        setImportFile(null);
        setImportText("");
        await loadOptions();
        await loadData();
        await historyRef.current?.reload();
      }
    } catch {
      setImportError("Terjadi kesalahan jaringan saat mengunggah data.");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Pembelian &amp; Suplier</h1>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Analisis rekapitulasi belanja masuk per vendor / suplier serta pemeriksaan nota faktur pembelian barang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setImportError(null);
              setImportSuccess(null);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            📥 Import Nota Pembelian
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="inline-flex rounded-lg bg-surface-subtle p-1 border border-border/60">
            {(
              [
                ["all", "Semua Data"],
                ["this_month", "Bulan Ini"],
                ["last_month", "Bulan Lalu"],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                onClick={() => applyDatePreset(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  datePreset === p ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Reset Filters */}
          {(fromDate || toDate || selectedVendor || selectedOutlet || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setDatePreset("all");
                setFromDate("");
                setToDate("");
                setSelectedVendor("");
                setSelectedOutlet("");
                setSearchQuery("");
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold transition-colors"
            >
              ✕ Reset Semua Filter
            </button>
          )}
        </div>

        {/* Detailed Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setDatePreset("custom");
                setFromDate(e.target.value);
              }}
              className="w-full rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setDatePreset("custom");
                setToDate(e.target.value);
              }}
              className="w-full rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Pilih Suplier / Vendor
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">Semua Suplier ({vendorOptions.length})</option>
              {vendorOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Cabang / Gudang Penerima
            </label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">Semua Lokasi ({outletOptions.length})</option>
              {outletOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Pencarian Cepat
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="No Faktur / Nama Item..."
              className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Total Belanja Masuk</p>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatRupiah(summary?.totalSpend ?? 0)}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Nilai kotor seluruh faktur pembelian</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Total Nota / Faktur</p>
          <p className="text-xl font-bold font-mono text-foreground mt-1">
            {formatNumber(summary?.invoiceCount ?? 0)} <span className="text-xs font-normal text-muted">nota</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">Transaksi nota pembelian masuk</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Suplier Aktif</p>
          <p className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            {formatNumber(summary?.vendorCount ?? 0)} <span className="text-xs font-normal text-muted">suplier</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">Vendor yang menyuplai barang</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Total Kuantitas Masuk</p>
          <p className="text-xl font-bold font-mono text-foreground mt-1">
            {formatNumber(summary?.totalQty ?? 0)} <span className="text-xs font-normal text-muted">pcs</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">{formatNumber(summary?.distinctItemCount ?? 0)} varian barang</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/80 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("vendors")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "vendors"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          🏢 Rekap per Suplier ({vendorRows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "invoices"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          🧾 Daftar Nota / Faktur ({invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("items")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "items"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          📦 Item Terbanyak Dibeli ({topItems.length})
        </button>
      </div>

      {/* TAB 1: PER VENDOR / SUPLIER */}
      {activeTab === "vendors" && (
        <div className="rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/80 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase w-12 text-center">No</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Suplier / Vendor</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Jumlah Faktur</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Varian Item</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Qty (Pcs)</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Pembelian</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Rata-rata / Nota</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-center w-36">Porsi Belanja</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted font-sans">
                      Memuat data suplier...
                    </td>
                  </tr>
                )}
                {!loading && vendorRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted font-sans">
                      Belum ada data pembelian untuk filter yang dipilih. Silakan klik &quot;Import Nota Pembelian&quot; di atas untuk memasukkan data.
                    </td>
                  </tr>
                )}
                {!loading &&
                  vendorRows.map((v, idx) => (
                    <tr key={v.vendor} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2.5 text-center text-muted font-sans">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-sans font-semibold text-foreground">
                        {v.vendor}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-foreground">
                        {formatNumber(v.invoiceCount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted">
                        {formatNumber(v.distinctItemCount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground">
                        {formatNumber(v.totalQty)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(v.totalSpend)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted font-sans">
                        {formatRupiah(v.avgPerInvoice)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-sans">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, v.percentage)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-muted w-10 text-right">
                            {v.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVendor(v.vendor);
                            setActiveTab("invoices");
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          Lihat Nota →
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DAFTAR NOTA / FAKTUR */}
      {activeTab === "invoices" && (
        <div className="rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/80 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase w-12 text-center">No</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">No Faktur</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Tanggal</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Suplier / Vendor</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Cabang / Gudang</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Qty</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Item</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Nilai Nota</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-center w-28">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted font-sans">
                      Memuat daftar nota pembelian...
                    </td>
                  </tr>
                )}
                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted font-sans">
                      Tidak ada faktur pembelian yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                )}
                {!loading &&
                  invoices.map((inv, idx) => (
                    <tr key={inv.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2.5 text-center text-muted font-sans">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-foreground">
                        <button
                          type="button"
                          onClick={() => openInvoiceDetail(inv.id)}
                          className="hover:underline text-accent"
                        >
                          {inv.invoiceNumber}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-sans text-muted">{inv.date}</td>
                      <td className="px-4 py-2.5 font-sans font-medium text-foreground">{inv.vendor}</td>
                      <td className="px-4 py-2.5 font-sans text-muted">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-surface-subtle border border-border/60">
                          {inv.outletName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground">{formatNumber(inv.totalQty)}</td>
                      <td className="px-4 py-2.5 text-right text-muted">{inv.itemCount} macam</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(inv.total)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => openInvoiceDetail(inv.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-surface-subtle border border-border/80 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-hover transition-colors shadow-2xs"
                        >
                          👁️ Rincian Nota
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TOP ITEM TERBANYAK DIBELI */}
      {activeTab === "items" && (
        <div className="rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/80 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase w-12 text-center">Rank</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Kode Item</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Barang / SKU</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Suplier Utama</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Qty Dibeli</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Belanja (Rp)</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Harga Rata-rata Beli</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted font-sans">
                      Memuat item pembelian...
                    </td>
                  </tr>
                )}
                {!loading && topItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted font-sans">
                      Tidak ada data barang pembelian.
                    </td>
                  </tr>
                )}
                {!loading &&
                  topItems.map((it, idx) => (
                    <tr key={`${it.itemCode}-${idx}`} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2.5 text-center text-muted font-sans font-bold">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-sans text-muted">{it.itemCode}</td>
                      <td className="px-4 py-2.5 font-sans font-semibold text-foreground">{it.itemName}</td>
                      <td className="px-4 py-2.5 font-sans text-muted">{it.vendor}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-foreground">
                        {formatNumber(it.totalQty)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(it.totalSpend)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted font-sans">
                        {formatRupiah(it.avgPrice)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RIWAYAT UPLOAD / BATCH IMPORT PEMBELIAN */}
      <PurchaseBatchHistory
        ref={historyRef}
        onChanged={() => {
          loadOptions();
          loadData();
        }}
      />

      {/* MODAL DETAIL NOTA FAKTUR PEMBELIAN */}
      {(activeInvoiceDetail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-4xl rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {detailLoading && (
              <div className="p-16 text-center text-muted text-xs">Memuat nota pembelian...</div>
            )}
            {activeInvoiceDetail && (
              <>
                {/* Header Nota */}
                <div className="p-5 border-b border-border/80 bg-surface-subtle/50 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold font-mono text-accent">
                        📄 Nota Pembelian #{activeInvoiceDetail.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted">
                      <span>
                        Tanggal: <strong className="text-foreground">{activeInvoiceDetail.date}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Suplier / Vendor: <strong className="text-foreground">{activeInvoiceDetail.vendor}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Penerima: <strong className="text-foreground">{activeInvoiceDetail.outletName}</strong>
                      </span>
                      {activeInvoiceDetail.refInvoice && (
                        <>
                          <span>•</span>
                          <span>
                            Ref: <strong className="text-foreground">{activeInvoiceDetail.refInvoice}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInvoiceDetail(null)}
                    className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Table Items */}
                <div className="flex-1 overflow-y-auto p-5">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-subtle text-muted text-left border-b border-border/80 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase w-10 text-center">No</th>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase w-24">Kode Item</th>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase">Nama Barang / Produk</th>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Qty</th>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-center w-16">Satuan</th>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Harga Satuan</th>
                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Subtotal Item</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {activeInvoiceDetail.items.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-surface-hover/50">
                          <td className="px-3 py-2 text-center text-muted font-sans">{it.itemSeq ?? idx + 1}</td>
                          <td className="px-3 py-2 text-muted font-sans">{it.itemCode}</td>
                          <td className="px-3 py-2 font-sans font-medium text-foreground">{it.itemName}</td>
                          <td className="px-3 py-2 text-right font-bold text-foreground">
                            {formatNumber(it.qty)}
                          </td>
                          <td className="px-3 py-2 text-center font-sans text-muted">{it.unit}</td>
                          <td className="px-3 py-2 text-right text-muted">{formatRupiah(it.price)}</td>
                          <td className="px-3 py-2 text-right font-bold text-foreground">
                            {formatRupiah(it.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Nota */}
                <div className="p-5 border-t border-border/80 bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-muted">
                    Total: <strong>{activeInvoiceDetail.items.length}</strong> jenis item
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-4 text-xs text-muted">
                      <span>Subtotal:</span>
                      <span className="font-mono">{formatRupiah(activeInvoiceDetail.subtotal)}</span>
                    </div>
                    {activeInvoiceDetail.discount > 0 && (
                      <div className="flex items-center justify-end gap-4 text-xs text-rose-500">
                        <span>Diskon Nota:</span>
                        <span className="font-mono">-{formatRupiah(activeInvoiceDetail.discount)}</span>
                      </div>
                    )}
                    {activeInvoiceDetail.tax > 0 && (
                      <div className="flex items-center justify-end gap-4 text-xs text-muted">
                        <span>Pajak:</span>
                        <span className="font-mono">+{formatRupiah(activeInvoiceDetail.tax)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border/60">
                      <span>Total Tagihan:</span>
                      <span className="font-mono text-base">{formatRupiah(activeInvoiceDetail.total)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL IMPORT PEMBELIAN */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>📥 Import Faktur / Nota Pembelian</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-muted hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Unggah file export faktur pembelian (.xlsx / .xls / .csv) atau salin teks data tabel dari POS (kolom: <code>No Faktur, Tanggal, Cabang, Vendor, Total, Kode Item, Nama Item, Qty, Harga, Subtotal Item</code>).
            </p>

            {/* Import Tabs */}
            <div className="inline-flex rounded-lg bg-surface-subtle p-1 border border-border/60">
              <button
                type="button"
                onClick={() => setImportTab("file")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  importTab === "file" ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground"
                }`}
              >
                📁 Unggah File Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => setImportTab("paste")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  importTab === "paste" ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground"
                }`}
              >
                📋 Salin &amp; Tempel Teks CSV
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              {importTab === "file" ? (
                <div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-border/80 bg-surface-subtle p-3 text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent-hover cursor-pointer"
                  />
                  {importFile && (
                    <p className="text-[11px] text-muted mt-1.5">File terpilih: <strong>{importFile.name}</strong> ({Math.round(importFile.size / 1024)} KB)</p>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    rows={6}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Tempel baris data CSV faktur pembelian di sini..."
                    className="w-full rounded-lg border border-border/80 bg-surface-subtle p-3 text-xs font-mono text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
              )}

              {importError && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {importError}
                </div>
              )}
              {importSuccess && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {importSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="rounded-lg border border-border/80 bg-surface px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={importBusy}
                  className="rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-xs"
                >
                  {importBusy ? "Memproses..." : "Mulai Import Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
