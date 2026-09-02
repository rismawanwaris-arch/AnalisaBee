"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export function TargetReportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") || yesterdayStr();

  const [date, setDate] = useState(dateParam);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [jpegBusy, setJpegBusy] = useState(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDate(dateParam), [dateParam]);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/target/report?date=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load(dateParam);
  }, [dateParam, load]);

  function applyDate(d: string) {
    router.push(`/target?date=${d}`);
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
      if (typeof va === "string" || typeof vb === "string") {
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [data, sortKey, sortDir]);

  const sums = useMemo(() => {
    const base = {
      server_sales: 0, server_trx: 0,
      tartun_sales: 0, tartun_trx: 0,
      petshop_sales: 0, petshop_pcs: 0,
      aksesoris_sales: 0, aksesoris_pcs: 0,
      sp_sales: 0, sp_pcs: 0,
      total_sales: 0, total_qty_trx: 0,
    };
    for (const r of sortedRows) {
      base.server_sales += r.server.sales; base.server_trx += r.server.qtyOrTrx;
      base.tartun_sales += r.tartun.sales; base.tartun_trx += r.tartun.qtyOrTrx;
      base.petshop_sales += r.petshop.sales; base.petshop_pcs += r.petshop.qtyOrTrx;
      base.aksesoris_sales += r.aksesoris.sales; base.aksesoris_pcs += r.aksesoris.qtyOrTrx;
      base.sp_sales += r.spVoucher.sales; base.sp_pcs += r.spVoucher.qtyOrTrx;
      base.total_sales += r.totalSales; base.total_qty_trx += r.totalQtyTrx;
    }
    return base;
  }, [sortedRows]);

  function exportExcel() {
    const table = document.getElementById("target-report-table");
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: "Target Sales Harian" });
    XLSX.writeFile(wb, `Target_Sales_Harian_${date}.xlsx`);
  }

  async function exportJpeg() {
    if (!tableWrapRef.current) return;
    setJpegBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(tableWrapRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `Target_Sales_Harian_${date}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } finally {
      setJpegBusy(false);
    }
  }

  const targets = data?.targets;
  const count = sortedRows.length || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">Tanggal Laporan</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => applyDate(date)}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Tampilkan
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={!data || sortedRows.length === 0}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-40"
          >
            Ekspor Excel
          </button>
          <button
            type="button"
            onClick={exportJpeg}
            disabled={!data || sortedRows.length === 0 || jpegBusy}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-40"
          >
            {jpegBusy ? "Memproses..." : "Ekspor JPEG"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Cetak / PDF
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted">Memuat laporan...</div>
      ) : (
        <>
          {data.unmappedItemGroups.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 no-print">
              Item Group berikut belum dipetakan ke kategori laporan, jadi tidak ikut dihitung:{" "}
              <strong>{data.unmappedItemGroups.join(", ")}</strong>. Atur di{" "}
              <a href="/target/pengaturan" className="underline">
                Pengaturan
              </a>
              .
            </div>
          )}

          <div ref={tableWrapRef} className="report-paper bg-surface rounded border border-border p-4">
            <div className="text-center mb-3 print-header">
              <h2 className="text-lg font-semibold">TARGET SALES HARIAN</h2>
              <p className="text-sm text-muted">
                {new Date(date).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table id="target-report-table" className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th colSpan={2} className="th-label">Target Perkonter</th>
                    <th className="th-num">{formatNumber(targets!.perkonter.SERVER)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.perkonter.TARTUN)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.perkonter.PETSHOP)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.perkonter.AKSESORIS)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.perkonter.SP_VOUCHER)}</th>
                    <th />
                    <th className="th-num">
                      {formatNumber(
                        targets!.perkonter.SERVER +
                          targets!.perkonter.TARTUN +
                          targets!.perkonter.PETSHOP +
                          targets!.perkonter.AKSESORIS +
                          targets!.perkonter.SP_VOUCHER
                      )}
                    </th>
                    <th colSpan={2} />
                  </tr>
                  <tr>
                    <th colSpan={2} className="th-label">Target All</th>
                    <th className="th-num">{formatNumber(targets!.all.SERVER)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.all.TARTUN)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.all.PETSHOP)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.all.AKSESORIS)}</th>
                    <th />
                    <th className="th-num">{formatNumber(targets!.all.SP_VOUCHER)}</th>
                    <th />
                    <th className="th-num">
                      {formatNumber(
                        targets!.all.SERVER +
                          targets!.all.TARTUN +
                          targets!.all.PETSHOP +
                          targets!.all.AKSESORIS +
                          targets!.all.SP_VOUCHER
                      )}
                    </th>
                    <th colSpan={2} />
                  </tr>
                  <tr className="main-header">
                    <th className="th-no-label">No</th>
                    <Th label="OUTLET" sk="outlet" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="SERVER" sk="server_sales" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="TRX" sk="server_trx" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="TARTUN" sk="tartun_sales" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="TRX" sk="tartun_trx" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="PETSHOP" sk="petshop_sales" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="PCS" sk="petshop_pcs" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="AKSESORIS" sk="aksesoris_sales" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="PCS" sk="aksesoris_pcs" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="SP/VOUCHER" sk="sp_sales" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="PCS" sk="sp_pcs" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="TOTAL" sk="total_sales" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                    <Th label="PCS/TRX" sk="total_qty_trx" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 && (
                    <tr>
                      <td colSpan={14} className="text-center py-8 text-muted">
                        Tidak ada outlet.
                      </td>
                    </tr>
                  )}
                  {sortedRows.map((r, idx) => (
                    <tr key={r.outletId} className="border-b border-border">
                      <td className="td-no">{idx + 1}</td>
                      <td className="td-outlet">{r.outlet}</td>
                      <Td value={r.server.sales} status={passFail(r.server.sales, targets!.perkonter.SERVER)} />
                      <td className="td-sub">{formatNumber(r.server.qtyOrTrx)}</td>
                      <Td value={r.tartun.sales} status={passFail(r.tartun.sales, targets!.perkonter.TARTUN)} />
                      <td className="td-sub">{formatNumber(r.tartun.qtyOrTrx)}</td>
                      <Td value={r.petshop.sales} status={passFail(r.petshop.sales, targets!.perkonter.PETSHOP)} />
                      <td className="td-sub">{formatNumber(r.petshop.qtyOrTrx)}</td>
                      <Td value={r.aksesoris.sales} status={passFail(r.aksesoris.sales, targets!.perkonter.AKSESORIS)} />
                      <td className="td-sub">{formatNumber(r.aksesoris.qtyOrTrx)}</td>
                      <Td value={r.spVoucher.sales} status={passFail(r.spVoucher.sales, targets!.perkonter.SP_VOUCHER)} />
                      <td className="td-sub">{formatNumber(r.spVoucher.qtyOrTrx)}</td>
                      <Td
                        value={r.totalSales}
                        status={passFail(
                          r.totalSales,
                          targets!.perkonter.SERVER +
                            targets!.perkonter.TARTUN +
                            targets!.perkonter.PETSHOP +
                            targets!.perkonter.AKSESORIS +
                            targets!.perkonter.SP_VOUCHER
                        )}
                        bold
                      />
                      <td className="td-sub">{formatNumber(r.totalQtyTrx)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <SummaryRow label="PENCAPAIAN TARGET" sums={sums} formatter={formatNumber} />
                  <SummaryRow
                    label="RATA-RATA"
                    sums={sums}
                    formatter={(v) => formatNumber(v / count)}
                  />
                  <tr className="border-t border-border">
                    <td colSpan={2} className="td-summary-label">PERSENTASE PENCAPAIAN</td>
                    <PctCell v={sums.server_sales} t={targets!.all.SERVER} />
                    <td />
                    <PctCell v={sums.tartun_sales} t={targets!.all.TARTUN} />
                    <td />
                    <PctCell v={sums.petshop_sales} t={targets!.all.PETSHOP} />
                    <td />
                    <PctCell v={sums.aksesoris_sales} t={targets!.all.AKSESORIS} />
                    <td />
                    <PctCell v={sums.sp_sales} t={targets!.all.SP_VOUCHER} />
                    <td />
                    <PctCell
                      v={sums.total_sales}
                      t={
                        targets!.all.SERVER +
                        targets!.all.TARTUN +
                        targets!.all.PETSHOP +
                        targets!.all.AKSESORIS +
                        targets!.all.SP_VOUCHER
                      }
                    />
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={2} className="td-summary-label">KONTRIBUSI THD TOTAL</td>
                    <PctCell v={sums.server_sales} t={sums.total_sales || 1} />
                    <td />
                    <PctCell v={sums.tartun_sales} t={sums.total_sales || 1} />
                    <td />
                    <PctCell v={sums.petshop_sales} t={sums.total_sales || 1} />
                    <td />
                    <PctCell v={sums.aksesoris_sales} t={sums.total_sales || 1} />
                    <td />
                    <PctCell v={sums.sp_sales} t={sums.total_sales || 1} />
                    <td />
                    <td className="td-num font-semibold">100%</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        #target-report-table .th-label {
          text-align: left;
          padding: 6px 10px;
          font-size: 0.72rem;
          color: var(--muted);
          font-family: inherit;
        }
        #target-report-table .th-num {
          text-align: right;
          padding: 6px 10px;
          font-size: 0.8rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        #target-report-table thead tr:nth-child(1),
        #target-report-table thead tr:nth-child(2) {
          background: var(--surface-hover);
        }
        #target-report-table .main-header th {
          background: var(--surface-hover);
          font-size: 0.68rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--muted);
          padding: 8px 10px;
          text-align: right;
          white-space: nowrap;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
        }
        #target-report-table .main-header th:nth-child(-n + 2) {
          text-align: left;
        }
        #target-report-table td {
          padding: 6px 10px;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        #target-report-table .td-no { color: var(--muted); width: 32px; }
        #target-report-table .td-outlet { font-weight: 500; white-space: normal; }
        #target-report-table .td-sub { color: var(--muted); text-align: right; font-size: 0.85em; }
        #target-report-table .td-num { text-align: right; }
        #target-report-table .td-summary-label { font-weight: 600; text-align: left; }
        #target-report-table tfoot tr { background: var(--surface-hover); }
        #target-report-table tfoot td { font-weight: 600; text-align: right; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

function Th({
  label,
  sk,
  sortKey,
  sortDir,
  toggleSort,
}: {
  label: string;
  sk?: SortKey;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
  toggleSort: (k: SortKey) => void;
}) {
  const key = sk ?? ("outlet" as SortKey);
  const active = sortKey === key;
  return (
    <th onClick={() => toggleSort(key)}>
      {label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}

function Td({ value, status, bold }: { value: number; status: "good" | "bad"; bold?: boolean }) {
  return (
    <td
      className="td-num"
      style={{
        color: status === "good" ? "var(--positive)" : "var(--negative)",
        fontWeight: bold ? 700 : 500,
      }}
    >
      {formatNumber(value)}
    </td>
  );
}

function PctCell({ v, t }: { v: number; t: number }) {
  const pct = t > 0 ? Math.round((v / t) * 100) : 0;
  return <td className="td-num">{pct}%</td>;
}

function SummaryRow({
  label,
  sums,
  formatter,
}: {
  label: string;
  sums: Record<string, number>;
  formatter: (v: number) => string;
}) {
  return (
    <tr>
      <td colSpan={2} className="td-summary-label">{label}</td>
      <td className="td-num">{formatter(sums.server_sales)}</td>
      <td className="td-num">{formatter(sums.server_trx)}</td>
      <td className="td-num">{formatter(sums.tartun_sales)}</td>
      <td className="td-num">{formatter(sums.tartun_trx)}</td>
      <td className="td-num">{formatter(sums.petshop_sales)}</td>
      <td className="td-num">{formatter(sums.petshop_pcs)}</td>
      <td className="td-num">{formatter(sums.aksesoris_sales)}</td>
      <td className="td-num">{formatter(sums.aksesoris_pcs)}</td>
      <td className="td-num">{formatter(sums.sp_sales)}</td>
      <td className="td-num">{formatter(sums.sp_pcs)}</td>
      <td className="td-num">{formatter(sums.total_sales)}</td>
      <td className="td-num">{formatter(sums.total_qty_trx)}</td>
    </tr>
  );
}
