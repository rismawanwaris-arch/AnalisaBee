
import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";

export interface PreviewRow {
  rowNumber: number;
  status: "NEW" | "DUPLICATE_EXISTING" | "DUPLICATE_IN_FILE";
  noTransaksi: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  subtotal: number;
  pegawai: string;
  duplicateOfRow?: number;
  existingImport?: { filename: string; uploadedAt: string };
}

export interface ImportPreview {
  totalRows: number;
  newCount: number;
  duplicateExistingCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  errors: { rowNumber: number; message: string }[];
  duplicates: PreviewRow[];
  duplicatesTruncated: boolean;
  newSample: PreviewRow[];
}

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<PreviewRow["status"], string> = {
  NEW: "Baru",
  DUPLICATE_EXISTING: "Sudah Ada di DB",
  DUPLICATE_IN_FILE: "Duplikat di File",
};

export function ImportPreviewPanel({
  filename,
  preview,
  busy,
  onCancel,
  onConfirm,
}: {
  filename: string;
  preview: ImportPreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(preview.duplicates.length / PAGE_SIZE));
  const pageRows = preview.duplicates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalDuplicates = preview.duplicateExistingCount + preview.duplicateInFileCount;

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-5 shadow-xs">
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <h2 className="text-base font-bold text-foreground">Pratinjau Data: {filename}</h2>
        </div>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Data belum disimpan ke database. Periksa rekap baris baru dan baris yang terdeteksi duplikat sebelum melakukan konfirmasi import.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Baris" value={formatNumber(preview.totalRows)} />
        <StatCard label="Akan Masuk (Baru)" value={formatNumber(preview.newCount)} />
        <StatCard label="Duplikat (Dilewati)" value={formatNumber(totalDuplicates)} />
        <StatCard label="Baris Error" value={formatNumber(preview.errorCount)} />
      </div>

      {preview.errors.length > 0 && (
        <details className="text-xs text-foreground bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
          <summary className="cursor-pointer text-rose-600 dark:text-rose-400 font-semibold">
            Lihat baris error ({formatNumber(preview.errorCount)}, maks 50 ditampilkan)
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto font-mono text-[11px] divide-y divide-rose-500/10">
            {preview.errors.map((e, i) => (
              <li key={i} className="py-1">
                Baris {e.rowNumber}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {totalDuplicates > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
            Baris Terdeteksi Duplikat ({formatNumber(totalDuplicates)})
            {preview.duplicatesTruncated && (
              <span className="text-muted font-normal lowercase"> — sebagian ditampilkan</span>
            )}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Baris</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">No Transaksi</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Tanggal</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Outlet</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Item</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase text-right">Qty</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase text-right">Subtotal</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageRows.map((r) => (
                  <tr key={r.rowNumber} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-3.5 py-2 font-mono text-muted text-[11px]">{r.rowNumber}</td>
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-foreground">{r.noTransaksi}</td>
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-muted">{formatDate(r.tanggal)}</td>
                    <td className="px-3.5 py-2 font-medium text-foreground">{r.cabang}</td>
                    <td className="px-3.5 py-2 max-w-52 truncate text-foreground" title={r.namaItem}>
                      {r.namaItem}
                    </td>
                    <td className="px-3.5 py-2 font-mono text-right text-foreground">{formatNumber(r.qty)}</td>
                    <td className="px-3.5 py-2 font-mono text-right text-foreground">{formatRupiah(r.subtotal)}</td>
                    <td className="px-3.5 py-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          r.status === "DUPLICATE_EXISTING"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.status === "DUPLICATE_IN_FILE" && r.duplicateOfRow != null && (
                        <div className="text-[10px] text-muted mt-0.5 whitespace-nowrap">
                          ↳ sama dengan baris {r.duplicateOfRow}
                        </div>
                      )}
                      {r.status === "DUPLICATE_EXISTING" && r.existingImport && (
                        <div className="text-[10px] text-muted mt-0.5 max-w-48 truncate" title={r.existingImport.filename}>
                          ↳ {r.existingImport.filename}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted mt-2 px-1">
              <span>
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-border/80 bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-hover disabled:opacity-40 transition-colors"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-border/80 bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-hover disabled:opacity-40 transition-colors"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {preview.newSample.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted font-medium hover:text-foreground">
            Contoh baris yang akan masuk sebagai data baru ({preview.newSample.length} dari{" "}
            {formatNumber(preview.newCount)})
          </summary>
          <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs mt-2">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">No Transaksi</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Tanggal</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Outlet</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Item</th>
                  <th className="px-3.5 py-2 font-semibold text-[11px] uppercase text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {preview.newSample.map((r) => (
                  <tr key={r.rowNumber} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-foreground">{r.noTransaksi}</td>
                    <td className="px-3.5 py-2 font-mono whitespace-nowrap text-muted">{formatDate(r.tanggal)}</td>
                    <td className="px-3.5 py-2 font-medium text-foreground">{r.cabang}</td>
                    <td className="px-3.5 py-2 max-w-52 truncate text-foreground" title={r.namaItem}>
                      {r.namaItem}
                    </td>
                    <td className="px-3.5 py-2 font-mono text-right text-foreground">{formatNumber(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-xl border border-border/80 bg-surface px-4 py-2 text-xs font-semibold hover:bg-surface-hover disabled:opacity-50 transition-all"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || preview.newCount === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
        >
          {busy ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Mengimpor data...</span>
            </>
          ) : (
            `Konfirmasi & Import ${formatNumber(preview.newCount)} Baris Baru`
          )}
        </button>
      </div>
    </div>
  );
}

