import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber, formatDate } from "@/lib/format";

interface UnmatchedRow {
  rowNumber: number;
  noPenjualan: string;
  namaBarang: string;
  reason: string;
}

interface ImportSummary {
  batchId: number | null;
  filename: string;
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  totalPoints: number;
  totalQty: number;
  unmatchedRows: UnmatchedRow[];
  parseErrors: { rowNumber: number; message: string }[];
}

interface BatchHistoryItem {
  id: number;
  filename: string;
  uploadedAt: string;
  rowCount: number;
  totalPoints: number;
}

export function SpPointsImport() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BatchHistoryItem[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/sp-points/history");
      if (res.ok) setHistory(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/sp-points/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengimpor file Poin SP.");
        return;
      }
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadHistory();
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteBatch(id: number) {
    if (!confirm("Yakin ingin menghapus riwayat import poin SP ini? Poin yang tercatat dalam file ini akan dihapus.")) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/sp-points/batch/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadHistory();
      }
    } catch {
      // ignore
    } finally {
      setDeleteBusy(false);
      setDeletingId(null);
    }
  }

  return (
    <div id="sp-points" className="rounded-xl border border-border/80 bg-surface p-5 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
            <h2 className="text-base font-bold text-foreground">
              Import Poin SP / Starterpack (di aktivasi)
            </h2>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Pencocokan poin penjualan kartu perdana SP/Starterpack berdasarkan nomor penjualan.
            Pastikan data penjualan POS sudah di-import terlebih dahulu.
          </p>
        </div>
        <a
          href="/api/sp-points/template"
          download="template_poin_sp.xlsx"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-surface-subtle hover:bg-surface-hover text-xs font-semibold text-foreground transition-all shadow-2xs shrink-0 self-start sm:self-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Unduh Template Excel
        </a>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border border-dashed border-border/80 bg-surface-subtle/50 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
            className="text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface file:text-foreground file:shadow-2xs hover:file:bg-surface-hover cursor-pointer"
          />

          {file && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="w-3 h-3 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                  Import Sekarang
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted">
          Format kolom Excel: <code>No Penjualan</code>, <code>Nama Barang</code>, <code>Qty</code>, <code>Point</code>.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-medium">
          {error}
        </div>
      )}

      {/* Success / Summary Message */}
      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2 text-xs">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{result.filename} berhasil diproses</span>
          </div>

          <div className="text-muted leading-relaxed">
            {formatNumber(result.totalRows)} baris file · <strong className="text-foreground">{formatNumber(result.matchedCount)} baris cocok</strong> · Total <strong className="text-foreground">{formatNumber(result.totalPoints)} poin</strong> ({formatNumber(result.totalQty)} pcs)
          </div>

          {result.unmatchedCount > 0 && (
            <details className="mt-2 text-amber-600 dark:text-amber-400">
              <summary className="cursor-pointer font-medium hover:underline">
                ▼ {result.unmatchedCount} nomor penjualan tidak ditemukan di data penjualan POS
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border/80 bg-surface p-2 text-[11px] space-y-1">
                {result.unmatchedRows.map((u, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1 text-muted">
                    <span className="font-mono text-foreground font-medium">{u.noPenjualan}</span>
                    <span className="truncate">{u.namaBarang}</span>
                    <span className="text-[10px] text-rose-500 shrink-0">{u.reason}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {result.parseErrors.length > 0 && (
            <details className="mt-1 text-rose-500">
              <summary className="cursor-pointer font-medium hover:underline">
                ▼ {result.parseErrors.length} baris tidak dapat dibaca
              </summary>
              <ul className="mt-1 pl-4 list-disc text-[11px] space-y-0.5">
                {result.parseErrors.map((pe, i) => (
                  <li key={i}>Baris {pe.rowNumber}: {pe.message}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Batch History Table */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
          Riwayat Import Poin SP
          <span className="ml-2 font-mono font-normal text-muted text-[10px]">
            {history.length} file tersimpan
          </span>
        </h3>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted">
            Belum ada riwayat import poin SP.
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 overflow-hidden shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/70 text-muted border-b border-border/80">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-[11px] uppercase">Waktu Upload</th>
                  <th className="px-3 py-2 text-left font-semibold text-[11px] uppercase">Nama File</th>
                  <th className="px-3 py-2 text-right font-semibold text-[11px] uppercase">Baris Cocok</th>
                  <th className="px-3 py-2 text-right font-semibold text-[11px] uppercase">Total Poin</th>
                  <th className="px-3 py-2 text-right font-semibold text-[11px] uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-3 py-2 text-muted whitespace-nowrap">
                      {formatDate(b.uploadedAt)}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {b.filename}
                    </td>
                    <td className="px-3 py-2 text-right text-muted font-mono">
                      {formatNumber(b.rowCount)}
                    </td>
                    <td className="px-3 py-2 text-right text-accent font-semibold font-mono">
                      {formatNumber(b.totalPoints)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(b.id)}
                        disabled={deleteBusy && deletingId === b.id}
                        className="text-[11px] text-muted hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-500/10 disabled:opacity-40"
                        title="Hapus riwayat import ini"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
