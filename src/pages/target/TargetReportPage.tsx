import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { formatNumber, formatRupiah } from "@/lib/format";
import { yesterdayStr } from "@/lib/dateDefaults";

interface Figure {
  sales: number;
  qtyOrTrx: number;
}

interface ReportRow {
  outletId: number;
  outlet: string;
  server: Figure;
  tartun: Figure;
  petshop: Figure;
  aksesoris: Figure;
  spVoucher: Figure;
  totalSales: number;
  totalQtyTrx: number;
}

interface TargetAmounts {
  SERVER: number;
  TARTUN: number;
  PETSHOP: number;
  AKSESORIS: number;
  SP_VOUCHER: number;
}

interface ReportResponse {
  rows: ReportRow[];
  unmappedItemGroups: string[];
  targets: { perkonter: TargetAmounts; all: TargetAmounts };
}

type SortKey =
  | "outlet"
  | "server_sales"
  | "server_trx"
  | "tartun_sales"
  | "tartun_trx"
  | "petshop_sales"
  | "petshop_pcs"
  | "aksesoris_sales"
  | "aksesoris_pcs"
  | "sp_sales"
  | "sp_pcs"
  | "total_sales"
  | "total_qty_trx";

const SORT_ACCESSORS: Record<SortKey, (r: ReportRow) => number | string> = {
  outlet: (r) => r.outlet,
  server_sales: (r) => r.server.sales,
  server_trx: (r) => r.server.qtyOrTrx,
  tartun_sales: (r) => r.tartun.sales,
  tartun_trx: (r) => r.tartun.qtyOrTrx,
  petshop_sales: (r) => r.petshop.sales,
  petshop_pcs: (r) => r.petshop.qtyOrTrx,
  aksesoris_sales: (r) => r.aksesoris.sales,
  aksesoris_pcs: (r) => r.aksesoris.qtyOrTrx,
  sp_sales: (r) => r.spVoucher.sales,
  sp_pcs: (r) => r.spVoucher.qtyOrTrx,
  total_sales: (r) => r.totalSales,
  total_qty_trx: (r) => r.totalQtyTrx,
};

function passFail(value: number, target: number): "good" | "bad" {
  return value >= target ? "good" : "bad";
}

export function TargetReportPage({ branch = "BANDUNG" }: { branch?: "BANDUNG" | "CIMAHI" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date") || yesterdayStr();

  const [date, setDate] = useState(dateParam);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [jpegBusy, setJpegBusy] = useState(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDate(dateParam), [dateParam]);

  const basePath = branch === "CIMAHI" ? "/cimahi/target" : "/target";

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/target/report?date=${d}&branch=${branch}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => {
    load(dateParam);
  }, [dateParam, load]);

  function applyDate(d: string) {
    navigate(`${basePath}?date=${d}`);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "outlet" ? "asc" : "desc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!data) return [];
    if (!sortKey) return data.rows;
    const accessor = SORT_ACCESSORS[sortKey];
    return [...data.rows].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
  }, [data, sortKey, sortDir]);

  const totals = useMemo(() => {
    if (!data) return null;
    const initial = {
      server: { sales: 0, trx: 0 },
      tartun: { sales: 0, trx: 0 },
      petshop: { sales: 0, pcs: 0 },
      aksesoris: { sales: 0, pcs: 0 },
      spVoucher: { sales: 0, pcs: 0 },
      totalSales: 0,
      totalQtyTrx: 0,
    };
    for (const r of data.rows) {
      initial.server.sales += r.server.sales;
      initial.server.trx += r.server.qtyOrTrx;
      initial.tartun.sales += r.tartun.sales;
      initial.tartun.trx += r.tartun.qtyOrTrx;
      initial.petshop.sales += r.petshop.sales;
      initial.petshop.pcs += r.petshop.qtyOrTrx;
      initial.aksesoris.sales += r.aksesoris.sales;
      initial.aksesoris.pcs += r.aksesoris.qtyOrTrx;
      initial.spVoucher.sales += r.spVoucher.sales;
      initial.spVoucher.pcs += r.spVoucher.qtyOrTrx;
      initial.totalSales += r.totalSales;
      initial.totalQtyTrx += r.totalQtyTrx;
    }
    return initial;
  }, [data]);

  const totalTargetAll = useMemo(() => {
    if (!data) return 0;
    const t = data.targets.all;
    return t.SERVER + t.TARTUN + t.PETSHOP + t.AKSESORIS + t.SP_VOUCHER;
  }, [data]);

  function exportExcel() {
    if (!data || !totals) return;
    const header = [
      "Outlet",
      "Server (Sales)",
      "Server (Trx)",
      "Tartun (Sales)",
      "Tartun (Trx)",
      "Petshop (Sales)",
      "Petshop (Pcs)",
      "Aksesoris (Sales)",
      "Aksesoris (Pcs)",
      "SP/Voucher (Sales)",
      "SP/Voucher (Pcs)",
      "Total Sales",
      "Total Qty/Trx",
    ];
    const rows = sortedRows.map((r) => [
      r.outlet,
      r.server.sales,
      r.server.qtyOrTrx,
      r.tartun.sales,
      r.tartun.qtyOrTrx,
      r.petshop.sales,
      r.petshop.qtyOrTrx,
      r.aksesoris.sales,
      r.aksesoris.qtyOrTrx,
      r.spVoucher.sales,
      r.spVoucher.qtyOrTrx,
      r.totalSales,
      r.totalQtyTrx,
    ]);
    const totalRow = [
      "TOTAL",
      totals.server.sales,
      totals.server.trx,
      totals.tartun.sales,
      totals.tartun.trx,
      totals.petshop.sales,
      totals.petshop.pcs,
      totals.aksesoris.sales,
      totals.aksesoris.pcs,
      totals.spVoucher.sales,
      totals.spVoucher.pcs,
      totals.totalSales,
      totals.totalQtyTrx,
    ];
    const targetAllRow = [
      "TARGET ALL",
      data.targets.all.SERVER,
      "",
      data.targets.all.TARTUN,
      "",
      data.targets.all.PETSHOP,
      "",
      data.targets.all.AKSESORIS,
      "",
      data.targets.all.SP_VOUCHER,
      "",
      totalTargetAll,
      "",
    ];
    const capPct = (actual: number, target: number) =>
      target > 0 ? `${((actual / target) * 100).toFixed(1)}%` : "-";
    const capRow = [
      "CAPAIAN (%)",
      capPct(totals.server.sales, data.targets.all.SERVER),
      "",
      capPct(totals.tartun.sales, data.targets.all.TARTUN),
      "",
      capPct(totals.petshop.sales, data.targets.all.PETSHOP),
      "",
      capPct(totals.aksesoris.sales, data.targets.all.AKSESORIS),
      "",
      capPct(totals.spVoucher.sales, data.targets.all.SP_VOUCHER),
      "",
      capPct(totals.totalSales, totalTargetAll),
      "",
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow, targetAllRow, capRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Target Harian");
    XLSX.writeFile(wb, `target-harian-${date}.xlsx`);
  }

  async function exportJpeg() {
    if (!tableWrapRef.current) return;
    setJpegBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(tableWrapRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `target-harian-${date}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } finally {
      setJpegBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-muted">Tanggal:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
          <button
            type="button"
            onClick={() => applyDate(date)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Tampilkan</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={!data}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-subtle hover:bg-surface-hover px-3 py-1.5 text-xs font-medium text-foreground transition-all disabled:opacity-50 shadow-2xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={exportJpeg}
            disabled={!data || jpegBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-subtle hover:bg-surface-hover px-3 py-1.5 text-xs font-medium text-foreground transition-all disabled:opacity-50 shadow-2xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span>{jpegBusy ? "Memproses..." : "JPEG"}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-subtle hover:bg-surface-hover px-3 py-1.5 text-xs font-medium text-foreground transition-all disabled:opacity-50 shadow-2xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {loading || !data || !totals ? (
        <div className="flex items-center justify-center p-12 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>Memuat laporan target...</span>
          </div>
        </div>
      ) : (
        <>
          {data.unmappedItemGroups.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400 no-print flex items-center gap-2 shadow-xs">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                Item Group berikut belum dipetakan:{" "}
                <strong className="font-semibold">{data.unmappedItemGroups.join(", ")}</strong>.
              </div>
            </div>
          )}

          <div ref={tableWrapRef} className="report-paper bg-surface rounded-xl border border-border/80 p-5 shadow-xs">
            <div className="text-center mb-4 print-header">
              <h2 className="text-lg font-bold text-foreground tracking-tight">TARGET SALES HARIAN</h2>
              <p className="text-sm text-muted">
                {(() => {
                  try {
                    const d = new Date(date);
                    return Number.isNaN(d.getTime())
                      ? date
                      : d.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        });
                  } catch {
                    return date;
                  }
                })()}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table id="target-report-table" className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-subtle/80 text-foreground border-b border-border/80">
                    <th
                      rowSpan={2}
                      onClick={() => toggleSort("outlet")}
                      className="px-3 py-2 text-left font-bold cursor-pointer hover:bg-surface-hover/80 select-none border-r border-border/60"
                    >
                      Outlet {sortKey === "outlet" && (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th colSpan={2} className="px-2 py-1 text-center font-bold border-r border-border/60">
                      Server (Target: {formatNumber(data.targets.perkonter.SERVER)})
                    </th>
                    <th colSpan={2} className="px-2 py-1 text-center font-bold border-r border-border/60">
                      Tartun (Target: {formatNumber(data.targets.perkonter.TARTUN)})
                    </th>
                    <th colSpan={2} className="px-2 py-1 text-center font-bold border-r border-border/60">
                      Petshop (Target: {formatNumber(data.targets.perkonter.PETSHOP)})
                    </th>
                    <th colSpan={2} className="px-2 py-1 text-center font-bold border-r border-border/60">
                      Aksesoris (Target: {formatNumber(data.targets.perkonter.AKSESORIS)})
                    </th>
                    <th colSpan={2} className="px-2 py-1 text-center font-bold border-r border-border/60">
                      SP/Voucher (Target: {formatNumber(data.targets.perkonter.SP_VOUCHER)})
                    </th>
                    <th colSpan={2} className="px-2 py-1 text-center font-bold">
                      Total
                    </th>
                  </tr>
                  <tr className="bg-surface-subtle/60 text-muted border-b border-border/80 font-mono text-[11px]">
                    <th onClick={() => toggleSort("server_sales")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Sales</th>
                    <th onClick={() => toggleSort("server_trx")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover border-r border-border/60">Trx</th>
                    <th onClick={() => toggleSort("tartun_sales")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Sales</th>
                    <th onClick={() => toggleSort("tartun_trx")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover border-r border-border/60">Trx</th>
                    <th onClick={() => toggleSort("petshop_sales")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Sales</th>
                    <th onClick={() => toggleSort("petshop_pcs")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover border-r border-border/60">Pcs</th>
                    <th onClick={() => toggleSort("aksesoris_sales")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Sales</th>
                    <th onClick={() => toggleSort("aksesoris_pcs")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover border-r border-border/60">Pcs</th>
                    <th onClick={() => toggleSort("sp_sales")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Sales</th>
                    <th onClick={() => toggleSort("sp_pcs")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover border-r border-border/60">Pcs</th>
                    <th onClick={() => toggleSort("total_sales")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Sales</th>
                    <th onClick={() => toggleSort("total_qty_trx")} className="px-2 py-1 text-right cursor-pointer hover:bg-surface-hover">Qty/Trx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {sortedRows.map((r) => {
                    const serverGood = passFail(r.server.sales, data.targets.perkonter.SERVER) === "good";
                    const tartunGood = passFail(r.tartun.sales, data.targets.perkonter.TARTUN) === "good";
                    const petshopGood = passFail(r.petshop.sales, data.targets.perkonter.PETSHOP) === "good";
                    const accGood = passFail(r.aksesoris.sales, data.targets.perkonter.AKSESORIS) === "good";
                    const spGood = passFail(r.spVoucher.sales, data.targets.perkonter.SP_VOUCHER) === "good";

                    return (
                      <tr key={r.outletId} className="hover:bg-surface-hover/70 transition-colors">
                        <td className="px-3 py-1.5 font-sans font-medium text-foreground border-r border-border/60 truncate max-w-44">
                          {r.outlet}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-medium ${serverGood ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted"}`}>
                          {formatNumber(r.server.sales)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted border-r border-border/60">{formatNumber(r.server.qtyOrTrx)}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${tartunGood ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted"}`}>
                          {formatNumber(r.tartun.sales)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted border-r border-border/60">{formatNumber(r.tartun.qtyOrTrx)}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${petshopGood ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted"}`}>
                          {formatNumber(r.petshop.sales)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted border-r border-border/60">{formatNumber(r.petshop.qtyOrTrx)}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${accGood ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted"}`}>
                          {formatNumber(r.aksesoris.sales)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted border-r border-border/60">{formatNumber(r.aksesoris.qtyOrTrx)}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${spGood ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted"}`}>
                          {formatNumber(r.spVoucher.sales)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted border-r border-border/60">{formatNumber(r.spVoucher.qtyOrTrx)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-foreground">{formatNumber(r.totalSales)}</td>
                        <td className="px-2 py-1.5 text-right text-muted">{formatNumber(r.totalQtyTrx)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border font-mono text-[11px] font-bold">
                  <tr className="bg-surface-subtle text-foreground">
                    <td className="px-3 py-2 font-sans border-r border-border/60">TOTAL REALISASI</td>
                    <td className="px-2 py-2 text-right">{formatNumber(totals.server.sales)}</td>
                    <td className="px-2 py-2 text-right border-r border-border/60">{formatNumber(totals.server.trx)}</td>
                    <td className="px-2 py-2 text-right">{formatNumber(totals.tartun.sales)}</td>
                    <td className="px-2 py-2 text-right border-r border-border/60">{formatNumber(totals.tartun.trx)}</td>
                    <td className="px-2 py-2 text-right">{formatNumber(totals.petshop.sales)}</td>
                    <td className="px-2 py-2 text-right border-r border-border/60">{formatNumber(totals.petshop.pcs)}</td>
                    <td className="px-2 py-2 text-right">{formatNumber(totals.aksesoris.sales)}</td>
                    <td className="px-2 py-2 text-right border-r border-border/60">{formatNumber(totals.aksesoris.pcs)}</td>
                    <td className="px-2 py-2 text-right">{formatNumber(totals.spVoucher.sales)}</td>
                    <td className="px-2 py-2 text-right border-r border-border/60">{formatNumber(totals.spVoucher.pcs)}</td>
                    <td className="px-2 py-2 text-right text-accent">{formatNumber(totals.totalSales)}</td>
                    <td className="px-2 py-2 text-right">{formatNumber(totals.totalQtyTrx)}</td>
                  </tr>
                  <tr className="bg-surface-subtle/50 text-muted">
                    <td className="px-3 py-1.5 font-sans border-r border-border/60">TARGET ALL</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(data.targets.all.SERVER)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(data.targets.all.TARTUN)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(data.targets.all.PETSHOP)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(data.targets.all.AKSESORIS)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(data.targets.all.SP_VOUCHER)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right font-bold text-foreground" colSpan={2}>{formatNumber(totalTargetAll)}</td>
                  </tr>
                  <tr className="bg-surface-subtle/70 text-foreground">
                    <td className="px-3 py-1.5 font-sans border-r border-border/60">CAPAIAN (%)</td>
                    <td className="px-2 py-1.5 text-right text-accent">{data.targets.all.SERVER > 0 ? `${((totals.server.sales / data.targets.all.SERVER) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right text-accent">{data.targets.all.TARTUN > 0 ? `${((totals.tartun.sales / data.targets.all.TARTUN) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right text-accent">{data.targets.all.PETSHOP > 0 ? `${((totals.petshop.sales / data.targets.all.PETSHOP) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right text-accent">{data.targets.all.AKSESORIS > 0 ? `${((totals.aksesoris.sales / data.targets.all.AKSESORIS) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right text-accent">{data.targets.all.SP_VOUCHER > 0 ? `${((totals.spVoucher.sales / data.targets.all.SP_VOUCHER) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border/60">-</td>
                    <td className="px-2 py-1.5 text-right font-bold text-accent" colSpan={2}>{totalTargetAll > 0 ? `${((totals.totalSales / totalTargetAll) * 100).toFixed(1)}%` : "-"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
