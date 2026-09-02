"use client";

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
  DUPLICATE_EXISTING: "Sudah ada di database",
  DUPLICATE_IN_FILE: "Duplikat dalam file ini",
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
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Pratinjau: {filename}</h2>
        <p className="text-sm text-muted mt-1">
          Belum ada yang disimpan. Cek dulu baris mana yang akan dianggap duplikat, lalu
          konfirmasi kalau sudah sesuai.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Baris" value={formatNumber(preview.totalRows)} />
        <StatCard label="Akan Masuk (Baru)" value={formatNumber(preview.newCount)} />
        <StatCard label="Duplikat" value={formatNumber(totalDuplicates)} />
        <StatCard label="Error" value={formatNumber(preview.errorCount)} />
      </div>

      {preview.errors.length > 0 && (
        <details className="text-sm text-foreground">
          <summary className="cursor-pointer text-muted">
            Lihat baris error ({formatNumber(preview.errorCount)}, maks 50 ditampilkan)
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {preview.errors.map((e, i) => (
              <li key={i}>
                Baris {e.rowNumber}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {totalDuplicates > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">
            Baris yang terdeteksi duplikat ({formatNumber(totalDuplicates)})
            {preview.duplicatesTruncated && (
              <span className="text-muted font-normal"> — menampilkan sebagian</span>
            )}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Baris</th>
                  <th className="px-3 py-2 font-medium">No Transaksi</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Outlet</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                  <th className="px-3 py-2 font-medium">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-2 text-muted">{r.rowNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.noTransaksi}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.tanggal)}</td>
                    <td className="px-3 py-2">{r.cabang}</td>
                    <td className="px-3 py-2 max-w-52 truncate" title={r.namaItem}>
                      {r.namaItem}
                    </td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.qty)}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(r.subtotal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === "DUPLICATE_EXISTING"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-negative/10 text-negative"
                        }`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted mt-2">
              <span>
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {preview.newSample.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            Contoh baris yang akan masuk sebagai data baru ({preview.newSample.length} dari{" "}
            {formatNumber(preview.newCount)})
          </summary>
          <div className="overflow-x-auto rounded-lg border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">No Transaksi</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Outlet</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.newSample.map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.noTransaksi}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.tanggal)}</td>
                    <td className="px-3 py-2">{r.cabang}</td>
                    <td className="px-3 py-2 max-w-52 truncate" title={r.namaItem}>
                      {r.namaItem}
                    </td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || preview.newCount === 0}
          className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy
            ? "Mengimpor..."
            : `Konfirmasi & Import ${formatNumber(preview.newCount)} Baris Baru`}
        </button>
      </div>
    </div>
  );
}
