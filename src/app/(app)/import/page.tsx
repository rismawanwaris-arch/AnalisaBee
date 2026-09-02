"use client";

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

export default function ImportPage() {
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

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/imports");
    if (res.ok) setHistory(await res.json());
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

  async function handleConfirmImport() {
    if (!pendingFile) return;
    setConfirmBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
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
    <div className="space-y-8">
      <div>
        <h1 className="text-sm font-bold">Import Data Excel</h1>
        <p className="text-sm text-muted mt-1">
          Unggah file export penjualan (.xls / .xlsx). Sebelum disimpan, Anda akan diperlihatkan
          pratinjau — baris mana yang baru dan mana yang terdeteksi duplikat — untuk dicek manual
          dulu sebelum konfirmasi.
        </p>
      </div>

      {!preview && (
        <div
          className="rounded-lg border-2 border-dashed border-border bg-surface p-8 text-center"
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
          <label
            htmlFor="file-input"
            className="inline-block cursor-pointer rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {previewLoading ? "Membaca file..." : "Pilih file Excel"}
          </label>
          <p className="text-sm text-muted mt-3">atau drag & drop file ke sini</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-negative/30 bg-negative/10 p-4 text-sm text-negative">
          {error}
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
        <div className="rounded-lg border border-positive/30 bg-positive/10 p-4 space-y-2">
          <div className="font-medium text-positive">
            Berhasil memproses {result.filename}
          </div>
          <div className="text-sm text-foreground grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>Total baris: {formatNumber(result.totalRows)}</div>
            <div>Baris baru: {formatNumber(result.insertedCount)}</div>
            <div>Duplikat (dilewati): {formatNumber(result.duplicateCount)}</div>
            <div>Baris error: {formatNumber(result.errorRowCount)}</div>
          </div>
          {result.errors.length > 0 && (
            <details className="text-sm text-foreground mt-2">
              <summary className="cursor-pointer">Lihat detail error (maks 50)</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
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
        <h2 className="text-lg font-semibold mb-3">Riwayat Import</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Waktu Upload</th>
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Periode</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Baris Baru</th>
                <th className="px-4 py-2 font-medium text-right">Duplikat</th>
                <th className="px-4 py-2 font-medium text-right">Error</th>
                <th className="px-4 py-2 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted">
                    Belum ada file yang diimpor.
                  </td>
                </tr>
              )}
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(h.uploadedAt)}</td>
                  <td className="px-4 py-2">{h.filename}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {h.periodStart && h.periodEnd
                      ? `${formatDate(h.periodStart)} – ${formatDate(h.periodEnd)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-4 py-2 text-right">{formatNumber(h.insertedCount)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(h.duplicateCount)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(h.errorRowCount)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(h);
                      }}
                      className="text-negative hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="Hapus import ini?"
        description={
          <>
            Ini akan menghapus <strong className="text-foreground">{deleteTarget?.filename}</strong>{" "}
            beserta <strong className="text-foreground">{formatNumber(deleteTarget?.insertedCount ?? 0)}</strong>{" "}
            baris data penjualan yang berasal dari file ini. Data outlet/item/pegawai lain tidak
            terpengaruh. Tindakan ini tidak bisa dibatalkan.
            {deleteError && <div className="text-negative mt-2">{deleteError}</div>}
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
    DONE: "bg-positive/10 text-positive",
    PROCESSING: "bg-amber-500/10 text-amber-600",
    FAILED: "bg-negative/10 text-negative",
  } as const;
  const labels = { DONE: "Selesai", PROCESSING: "Memproses", FAILED: "Gagal" } as const;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
