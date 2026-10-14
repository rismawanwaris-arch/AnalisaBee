import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from "react";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { useAuth } from "@/context/AuthContext";

export interface PurchaseBatchHistoryItem {
  id: number;
  filename: string;
  uploadedAt: string;
  status: "PROCESSING" | "DONE" | "FAILED";
  errorMessage: string | null;
  rowCount: number;
  insertedCount: number;
  duplicateCount: number;
  errorRowCount: number;
  filePeriodStart: string | null;
  filePeriodEnd: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  invoiceCount: number;
  itemCount: number;
  totalSpend: number;
}

export interface PurchaseBatchHistoryHandle {
  reload: () => Promise<void>;
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** "Riwayat Batch Import" for purchase uploads — same layout as the sales
 *  history on /import. The Periode column is computed from the invoices that
 *  currently belong to each batch, so it reflects the real data (not just what
 *  was in the file at upload time). */
export function PurchaseBatchHistory({
  ref,
  onChanged,
  limit = 10,
}: {
  ref?: Ref<PurchaseBatchHistoryHandle>;
  onChanged?: () => void;
  limit?: number;
}) {
  const { role, canAccess } = useAuth();
  const hasAccess = canAccess ? canAccess("purchases") : true;
  const isMaster = role === "master";
  const [history, setHistory] = useState<PurchaseBatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseBatchHistoryItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/purchases/batches");
      if (res.ok) setHistory(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [hasAccess]);

  useImperativeHandle(ref, () => ({ reload: load }), [load]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/purchases/batches/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Gagal menghapus batch.");
        return;
      }
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch {
      setDeleteError("Terjadi kesalahan jaringan saat menghapus.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const visible = showAll ? history : history.slice(0, limit);
  const colCount = isMaster ? 10 : 9;

  // Overall period covered by all purchase data currently in the database.
  const allStarts = history.map((h) => h.periodStart).filter((d): d is string => !!d).sort();
  const allEnds = history.map((h) => h.periodEnd).filter((d): d is string => !!d).sort();
  const overallStart = allStarts[0] ?? null;
  const overallEnd = allEnds[allEnds.length - 1] ?? null;

  if (!hasAccess) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Riwayat Batch Import Pembelian</h2>
        <div className="flex flex-wrap items-center gap-2">
          {overallStart && overallEnd && (
            <span className="text-[11px] font-mono text-muted bg-surface border border-border/80 rounded px-2 py-0.5">
              Data tersedia: {formatPeriod(overallStart, overallEnd)}
            </span>
          )}
          <span className="text-[11px] font-mono text-muted bg-surface border border-border/80 rounded px-2 py-0.5">
            {history.length} batch
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-xs">
        <table className="w-full text-xs">
          <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Waktu Upload</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">File</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Periode Data</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Status</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Nota</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Baris Item</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Nilai</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Nota Baru</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Diperbarui / Error</th>
              {isMaster && <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading && history.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-muted">
                  Memuat riwayat import...
                </td>
              </tr>
            )}
            {!loading && history.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-muted">
                  Belum ada file pembelian yang diimpor ke database.
                </td>
              </tr>
            )}
            {visible.map((h) => {
              const filePeriod = formatPeriod(h.filePeriodStart, h.filePeriodEnd);
              const livePeriod = formatPeriod(h.periodStart, h.periodEnd);
              const periodChanged = h.invoiceCount > 0 && filePeriod !== livePeriod;
              return (
                <tr key={h.id} className="hover:bg-surface-hover/70 transition-colors align-top">
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap text-muted">{formatDate(h.uploadedAt)}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {h.filename}
                    {h.errorMessage && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{h.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap text-foreground">
                    {h.invoiceCount > 0 ? livePeriod : <span className="text-muted">-</span>}
                    {periodChanged && (
                      <div className="text-[10px] text-muted mt-0.5" title="Periode sesuai isi file saat diupload">
                        File: {filePeriod}
                      </div>
                    )}
                    {h.invoiceCount === 0 && h.filePeriodStart && (
                      <div className="text-[10px] text-muted mt-0.5" title="Semua nota batch ini sudah dihapus atau diperbarui oleh upload lain">
                        File: {filePeriod} (nota sudah pindah/terhapus)
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right text-foreground">{formatNumber(h.invoiceCount)}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-muted">{formatNumber(h.itemCount)}</td>
                  <td className="px-4 py-2.5 font-mono text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatRupiah(h.totalSpend)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right text-foreground">{formatNumber(h.insertedCount)}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-muted whitespace-nowrap">
                    {formatNumber(h.duplicateCount)} / {formatNumber(h.errorRowCount)}
                  </td>
                  {isMaster && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(h);
                        }}
                        className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {history.length > limit && (
          <div className="px-4 py-2 text-[11px] text-muted text-center border-t border-border/60 bg-surface-subtle/40">
            {showAll ? `Menampilkan semua ${history.length} batch.` : `Menampilkan ${limit} batch terbaru dari ${history.length}.`}{" "}
            <button type="button" onClick={() => setShowAll((v) => !v)} className="font-semibold text-accent hover:underline">
              {showAll ? "Tampilkan lebih sedikit" : "Tampilkan semua"}
            </button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted mt-2 leading-relaxed">
        <strong>Periode Data</strong> dihitung dari tanggal nota yang saat ini tersimpan di batch tersebut. Nota dengan
        No Faktur yang sama akan diperbarui (bukan dobel) dan berpindah ke batch upload terbaru — jumlahnya tercatat di
        kolom <em>Diperbarui</em>.
      </p>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="Hapus batch import pembelian ini?"
        description={
          <>
            Tindakan ini akan menghapus file <strong className="text-foreground">{deleteTarget?.filename}</strong> beserta{" "}
            <strong className="text-foreground">{formatNumber(deleteTarget?.invoiceCount ?? 0)} nota</strong> (
            {formatNumber(deleteTarget?.itemCount ?? 0)} baris item) yang saat ini tersimpan di batch tersebut.
            {deleteError && <div className="text-rose-600 dark:text-rose-400 mt-2">{deleteError}</div>}
          </>
        }
        confirmText={deleteTarget?.filename ?? ""}
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseBatchHistoryItem["status"] }) {
  const styles = {
    DONE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    PROCESSING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    FAILED: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  } as const;
  const labels = { DONE: "Selesai", PROCESSING: "Memproses", FAILED: "Gagal" } as const;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
