import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber, formatDate } from "@/lib/format";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { ImportPreviewPanel, type ImportPreview } from "@/components/ImportPreviewPanel";
import { TartunServerImport } from "@/components/TartunServerImport";

interface ImportSummary {
  importId: number;
  filename: string;
  totalRows: number;
  parsedRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorRowCount: number;
  errors: { rowNumber: number; message: string }[];
  periodStart: string | null;
  periodEnd: string | null;
}

interface ImportHistoryItem {
  id: number;
  filename: string;
  uploadedAt: string;
  status: "PROCESSING" | "DONE" | "FAILED";
  rowCount: number;
  insertedCount: number;
  duplicateCount: number;
  errorRowCount: number;
  errorMessage: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export function ImportPage() {
  const [branch, setBranch] = useState<"BANDUNG" | "CIMAHI">("BANDUNG");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ImportHistoryItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleHistory = history.slice(0, 10);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/imports");
      if (res.ok) setHistory(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/imports/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Gagal menghapus import.");
        return;
      }
      setDeleteTarget(null);
      await loadHistory();
    } catch {
      setDeleteError("Terjadi kesalahan jaringan saat menghapus.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleFileSelected(file: File) {
    setError(null);
    setResult(null);
    setPreview(null);
    setPendingFile(file);
    setPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membaca file.");
        setPendingFile(null);
      } else {
        setPreview(data);
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat membaca file.");
      setPendingFile(null);
    } finally {
      setPreviewLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleCancelPreview() {
    setPendingFile(null);
    setPreview(null);
  }

  async function handleConfirmImport(forceImportHashes: string[] = []) {
    if (!pendingFile) return;
    setConfirmBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("branch", branch);
      if (forceImportHashes.length > 0) {
        formData.append("forceImportHashes", JSON.stringify(forceImportHashes));
      }
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengimpor file.");
      } else {
        setResult(data);
        setPendingFile(null);
        setPreview(null);
        await loadHistory();
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat mengunggah file.");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Manajemen Import Data</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Unggah file export transaksi penjualan (.xls / .xlsx) dari sistem POS. Sistem secara otomatis mendeteksi baris baru dan melewati baris duplikat.
        </p>
      </div>

      {/* Branch selector */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
        <p className="text-xs font-semibold text-foreground mb-3">Pilih Cabang untuk Import Ini</p>
        <div className="flex gap-3">
          {(["BANDUNG", "CIMAHI"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBranch(b)}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                branch === b
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border/80 bg-surface-subtle text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {b === "BANDUNG" ? "Cabang Bandung" : "Cabang Cimahi"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-2">
          Semua outlet dari file ini akan ditandai sebagai <strong>{branch === "BANDUNG" ? "Cabang Bandung" : "Cabang Cimahi"}</strong>.
        </p>
      </div>

      {!preview && (
        <div
          className="relative rounded-2xl border-2 border-dashed border-border/80 hover:border-accent bg-surface p-10 text-center transition-all duration-200 shadow-xs group"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileSelected(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            id="file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-3.5 group-hover:scale-105 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <label
            htmlFor="file-input"
            className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            {previewLoading ? "Membaca file..." : "Pilih File Excel"}
          </label>
          <p className="text-xs text-muted mt-2.5">
            atau seret &amp; letakkan file <span className="font-mono text-foreground">.xls / .xlsx</span> ke area ini
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {preview && pendingFile && (
        <ImportPreviewPanel
          filename={pendingFile.name}
          preview={preview}
          busy={confirmBusy}
          onCancel={handleCancelPreview}
          onConfirm={handleConfirmImport}
        />
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-2.5 text-xs">
          <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Berhasil memproses {result.filename}</span>
          </div>
          <div className="text-foreground grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
            <div className="bg-surface/60 rounded-lg p-2 border border-border/40">Total: <strong>{formatNumber(result.totalRows)}</strong> baris</div>
            <div className="bg-surface/60 rounded-lg p-2 border border-border/40">Baru: <strong>{formatNumber(result.insertedCount)}</strong> baris</div>
            <div className="bg-surface/60 rounded-lg p-2 border border-border/40">Duplikat: <strong>{formatNumber(result.duplicateCount)}</strong> baris</div>
            <div className="bg-surface/60 rounded-lg p-2 border border-border/40">Error: <strong>{formatNumber(result.errorRowCount)}</strong> baris</div>
          </div>
          {result.errors.length > 0 && (
            <details className="mt-2 text-muted">
              <summary className="cursor-pointer font-medium hover:text-foreground">Lihat detail error ({result.errors.length})</summary>
              <ul className="mt-1.5 space-y-1 max-h-48 overflow-y-auto font-mono text-[11px]">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Baris {e.rowNumber}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <TartunServerImport />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Riwayat Batch Import</h2>
          <span className="text-[11px] font-mono text-muted bg-surface border border-border/80 rounded px-2 py-0.5">
            {history.length} batch
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Waktu Upload</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">File</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Periode</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Status</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Baris Baru</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Duplikat</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Error</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {history.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    Belum ada file yang diimpor ke database.
                  </td>
                </tr>
              )}
              {visibleHistory.map((h) => (
                <tr key={h.id} className="hover:bg-surface-hover/70 transition-colors">
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap text-muted">{formatDate(h.uploadedAt)}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{h.filename}</td>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap text-muted">
                    {h.periodStart && h.periodEnd
                      ? `${formatDate(h.periodStart)} – ${formatDate(h.periodEnd)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right text-foreground">{formatNumber(h.insertedCount)}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-muted">{formatNumber(h.duplicateCount)}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-muted">{formatNumber(h.errorRowCount)}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
          {history.length > visibleHistory.length && (
            <div className="px-4 py-2 text-[11px] text-muted text-center border-t border-border/60 bg-surface-subtle/40">
              Menampilkan 10 batch terbaru dari {history.length}.
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="Hapus batch import ini?"
        description={
          <>
            Tindakan ini akan menghapus file <strong className="text-foreground">{deleteTarget?.filename}</strong> beserta <strong className="text-foreground">{formatNumber(deleteTarget?.insertedCount ?? 0)} baris</strong> data transaksi yang bersangkutan.
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

function StatusBadge({ status }: { status: ImportHistoryItem["status"] }) {
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
