
import { Fragment, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import type { OriginalRowSnapshot } from "@/lib/importSales";

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
  originalRow?: OriginalRowSnapshot;
  existingImport?: { filename: string; uploadedAt: string };
}

export interface ImportPreview {
  totalRows: number;
  newCount: number;
  duplicateExistingCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  noCabangCount: number;
  errors: {
    rowNumber: number;
    message: string;
    rawSnapshot?: {
      noTransaksi: string;
      tanggal: string;
      cabang: string;
      kodeItem: string;
      namaItem: string;
      qty: string;
      pegawai: string;
    };
  }[];
  duplicates: PreviewRow[];
  duplicatesTruncated: boolean;
  newSample: PreviewRow[];
}

const PAGE_SIZE = 25;

function Field({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-muted">{label}: </span>
      {value ? (
        <span className={`font-medium ${warn ? "text-rose-400" : "text-foreground"}`}>{value}</span>
      ) : (
        <span className="text-rose-400 font-semibold">KOSONG ⚠</span>
      )}
    </div>
  );
}

function RowDataGrid({
  noTransaksi, tanggal, cabang, kodeItem, namaItem, qty, pegawai,
}: {
  noTransaksi: string; tanggal: string; cabang: string; kodeItem: string;
  namaItem: string; qty: string; pegawai: string;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] bg-black/10 rounded-lg px-3 py-2">
      <Field label="No Transaksi" value={noTransaksi} />
      <Field label="Tanggal" value={tanggal} />
      <Field label="Pegawai" value={pegawai} />
      <Field label="Cabang" value={cabang} warn={!cabang} />
      <Field label="Kode Item" value={kodeItem} />
      <Field label="Nama Item" value={namaItem} />
      <Field label="Qty" value={qty} />
    </div>
  );
}

function OriginalRowComparison({ orig }: { orig: OriginalRowSnapshot }) {
  return (
    <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px] bg-amber-500/10 rounded-lg px-3 py-2">
      <Field label="No Transaksi" value={orig.noTransaksi} />
      <Field label="Tanggal" value={formatDate(orig.tanggal)} />
      <Field label="Outlet" value={orig.cabang} />
      <Field label="Item" value={orig.namaItem} />
      <Field label="Qty" value={String(orig.qty)} />
      <Field label="Subtotal" value={formatRupiah(orig.subtotal)} />
      <Field label="Pegawai" value={orig.pegawai} />
    </div>
  );
}

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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const totalPages = Math.max(1, Math.ceil(preview.duplicates.length / PAGE_SIZE));
  const pageRows = preview.duplicates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalDuplicates = preview.duplicateExistingCount + preview.duplicateInFileCount;

  function toggleRow(rowNumber: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(rowNumber) ? next.delete(rowNumber) : next.add(rowNumber);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-5 shadow-xs">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <h2 className="text-base font-bold text-foreground">Pratinjau Data: {filename}</h2>
        </div>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Data belum disimpan ke database. Periksa rekap baris baru dan baris yang terdeteksi duplikat sebelum melakukan konfirmasi import.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Baris" value={formatNumber(preview.totalRows)} />
        <StatCard label="Akan Masuk (Baru)" value={formatNumber(preview.newCount)} />
        <StatCard label="Duplikat (Dilewati)" value={formatNumber(totalDuplicates)} />
        <StatCard label="Baris Error" value={formatNumber(preview.errorCount)} />
      </div>

      {/* noCabang notice */}
      {preview.noCabangCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs">
          <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-600 dark:text-amber-400">
              {formatNumber(preview.noCabangCount)} baris tidak memiliki data Outlet
            </p>
            <p className="text-muted leading-relaxed">
              Outlet untuk baris-baris ini diinferensikan otomatis dari riwayat transaksi pegawai di database.
              Jika pegawai belum pernah ada di sistem, outlet default <strong>"TIDAK DIKETAHUI"</strong> akan digunakan.
              Data tetap diimport dan tetap terhitung dalam laporan pegawai.
            </p>
          </div>
        </div>
      )}

      {/* Overlapping import safety note */}
      {totalDuplicates > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs">
          <span className="text-blue-400 text-base leading-none mt-0.5">ℹ</span>
          <div className="space-y-0.5">
            <p className="font-semibold text-blue-500 dark:text-blue-400">
              Import periode overlap aman — tidak akan double-count
            </p>
            <p className="text-muted leading-relaxed">
              Sistem mendeteksi duplikat berdasarkan <strong>hash unik per transaksi</strong> (termasuk No Transaksi dari POS).
              Jika Anda import periode <em>29 Agu – 2 Sep</em> lalu <em>2 Sep – 10 Sep</em>, transaksi tanggal 2 Sep
              yang sudah ada di database akan terdeteksi sebagai <strong>Sudah Ada di DB</strong> dan dilewati otomatis.
              Hanya transaksi baru yang belum ada yang akan masuk.
            </p>
          </div>
        </div>
      )}

      {/* Error section — always expanded, raw data always visible */}
      {preview.errors.length > 0 && (
        <div className="border border-rose-500/25 rounded-xl overflow-hidden">
          <div className="bg-rose-500/10 px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-sm font-bold text-rose-500 dark:text-rose-400">
              {formatNumber(preview.errorCount)} Baris Error — Tidak Akan Diimport
            </span>
          </div>
          <p className="text-[11px] text-muted px-4 py-2 border-b border-rose-500/15">
            Baris di bawah gagal dibaca sistem. Periksa data mentah masing-masing untuk menentukan apakah kolom di file Excel memang kosong atau ada masalah format.
          </p>
          <ul className="divide-y divide-rose-500/10 max-h-[28rem] overflow-y-auto">
            {preview.errors.map((e, i) => {
              const snap = e.rawSnapshot;
              return (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-muted shrink-0 bg-rose-500/10 rounded px-1.5 py-0.5">
                      #{e.rowNumber}
                    </span>
                    <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">
                      {e.message}
                    </span>
                  </div>
                  {snap ? (
                    <RowDataGrid
                      noTransaksi={snap.noTransaksi}
                      tanggal={snap.tanggal}
                      cabang={snap.cabang}
                      kodeItem={snap.kodeItem}
                      namaItem={snap.namaItem}
                      qty={snap.qty}
                      pegawai={snap.pegawai}
                    />
                  ) : (
                    <p className="mt-1.5 ml-6 text-[11px] text-muted italic">
                      Data mentah tidak tersedia — upload ulang file untuk melihat detail.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Duplicate section */}
      {totalDuplicates > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Baris Terdeteksi Duplikat ({formatNumber(totalDuplicates)})
            </h3>
            {preview.duplicatesTruncated && (
              <span className="text-muted text-[11px]">— sebagian ditampilkan</span>
            )}
          </div>
          <p className="text-[11px] text-muted mb-2">
            Baris duplikat <strong>tidak akan diimport ulang</strong>.
            Klik baris <span className="text-rose-400 font-semibold">Duplikat di File</span> untuk
            melihat data baris asli dan memverifikasi apakah memang sama.
          </p>
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
                {pageRows.map((r) => {
                  const isExpanded = expandedRows.has(r.rowNumber);
                  const canExpand = r.status === "DUPLICATE_IN_FILE" && (r.originalRow != null || r.duplicateOfRow != null);
                  return (
                    <Fragment key={r.rowNumber}>
                      <tr
                        className={`transition-colors ${canExpand ? "cursor-pointer hover:bg-surface-hover/60" : "hover:bg-surface-hover/40"} ${isExpanded ? "bg-amber-500/5" : ""}`}
                        onClick={() => canExpand && toggleRow(r.rowNumber)}
                      >
                        <td className="px-3.5 py-2.5 font-mono text-muted text-[11px]">{r.rowNumber}</td>
                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap text-foreground">{r.noTransaksi}</td>
                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap text-muted">{formatDate(r.tanggal)}</td>
                        <td className="px-3.5 py-2.5 font-medium text-foreground">{r.cabang}</td>
                        <td className="px-3.5 py-2.5 max-w-52 truncate text-foreground" title={r.namaItem}>
                          {r.namaItem}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-right text-foreground">{formatNumber(r.qty)}</td>
                        <td className="px-3.5 py-2.5 font-mono text-right text-foreground">{formatRupiah(r.subtotal)}</td>
                        <td className="px-3.5 py-2.5">
                          {r.status === "DUPLICATE_IN_FILE" ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20 whitespace-nowrap">
                                  Duplikat di File
                                </span>
                                {canExpand && (
                                  <span className="text-[10px] text-muted">{isExpanded ? "▲" : "▼"}</span>
                                )}
                              </div>
                              {r.duplicateOfRow != null && (
                                <div className="text-[10px] text-muted mt-0.5">
                                  ↳ sama dengan baris {r.duplicateOfRow}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 whitespace-nowrap">
                                Sudah Ada di DB
                              </span>
                              {r.existingImport && (
                                <div className="text-[10px] text-muted mt-0.5 max-w-44">
                                  <div className="truncate" title={r.existingImport.filename}>
                                    ↳ {r.existingImport.filename}
                                  </div>
                                  <div className="text-[9px]">
                                    {formatDate(r.existingImport.uploadedAt)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expanded comparison for DUPLICATE_IN_FILE */}
                      {isExpanded && r.status === "DUPLICATE_IN_FILE" && (
                        <tr className="bg-amber-500/5">
                          <td colSpan={8} className="px-4 pb-3 pt-1">
                            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                              Perbandingan data — baris {r.rowNumber} vs baris asli #{r.duplicateOfRow}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <div className="text-[10px] font-bold text-muted uppercase mb-1">
                                  Baris {r.rowNumber} (duplikat — dilewati)
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] border border-rose-500/20 rounded-lg px-3 py-2">
                                  <Field label="No" value={r.noTransaksi} />
                                  <Field label="Tgl" value={formatDate(r.tanggal)} />
                                  <Field label="Outlet" value={r.cabang} />
                                  <Field label="Item" value={r.namaItem} />
                                  <Field label="Qty" value={String(r.qty)} />
                                  <Field label="Subtotal" value={formatRupiah(r.subtotal)} />
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-muted uppercase mb-1">
                                  Baris {r.duplicateOfRow} (asli — diimport)
                                </div>
                                {r.originalRow ? (
                                  <OriginalRowComparison orig={r.originalRow} />
                                ) : (
                                  <div className="text-[11px] text-muted border border-border/60 rounded-lg px-3 py-2">
                                    <p className="italic">Data baris asli tidak tersedia.</p>
                                    <p className="mt-1">
                                      Upload ulang file ini untuk melihat perbandingan lengkap.
                                      Karena hash identik, dapat dipastikan kedua baris memiliki data yang sama persis.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-muted mt-2">
                              Kedua baris memiliki hash yang sama — sistem memastikan datanya identik.
                              Jika menurut Anda ini bukan duplikat, periksa file sumber dan pastikan
                              tidak ada baris yang terduplikasi saat export dari POS.
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted mt-2 px-1">
              <span>Halaman {page} dari {totalPages}</span>
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

      {/* New rows sample */}
      {preview.newSample.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted font-medium hover:text-foreground select-none">
            Contoh baris baru yang akan masuk ({preview.newSample.length} dari {formatNumber(preview.newCount)})
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
                    <td className="px-3.5 py-2 max-w-52 truncate text-foreground" title={r.namaItem}>{r.namaItem}</td>
                    <td className="px-3.5 py-2 font-mono text-right text-foreground">{formatNumber(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Action buttons */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        {preview.errorCount > 0 && (
          <p className="text-[11px] text-muted">
            ⚠ {formatNumber(preview.errorCount)} baris error akan dilewati secara otomatis.
            Import tetap bisa dilanjutkan untuk {formatNumber(preview.newCount)} baris baru yang valid.
          </p>
        )}
        <div className="flex justify-end gap-2.5">
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
    </div>
  );
}
