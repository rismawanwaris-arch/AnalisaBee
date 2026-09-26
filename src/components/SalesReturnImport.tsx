import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

type Branch = "BANDUNG" | "CIMAHI";

const BRANCH_LABEL: Record<Branch, string> = {
  BANDUNG: "Cabang Bandung",
  CIMAHI: "Cabang Cimahi",
};

interface ReturPreviewRow {
  rowNumber: number;
  status: "NEW" | "DUPLICATE_EXISTING" | "DUPLICATE_IN_FILE";
  rowHash?: string;
  noRetur: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  noPenjualan: string;
  matched: boolean;
  employeeName: string;
}

interface ReturImportPreview {
  totalRows: number;
  newCount: number;
  duplicateExistingCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  matchedCount: number;
  unmatchedCount: number;
  errors: { rowNumber: number; message: string }[];
  duplicates: ReturPreviewRow[];
  duplicatesTruncated: boolean;
  newSample: ReturPreviewRow[];
}

interface ReturImportResult {
  importId: number;
  filename: string;
  totalRows: number;
  parsedRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorRowCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

export function SalesReturnImport() {
  const [branch, setBranch] = useState<Branch>("BANDUNG");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReturImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [result, setResult] = useState<ReturImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPendingFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
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
      formData.append("branch", branch);
      const res = await fetch("/api/import/retur/preview", { method: "POST", body: formData });
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

  async function handleConfirmImport() {
    if (!pendingFile) return;
    setConfirmBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("branch", branch);
      const res = await fetch("/api/import/retur", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengimpor file.");
      } else {
        setResult(data);
        setPendingFile(null);
        setPreview(null);
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat mengunggah file.");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted leading-relaxed">
        Import retur penjualan harian — setiap baris retur membatalkan omzet, laba, dan poin
        pegawai dari penjualan aslinya (dicocokkan lewat No.Penjualan + Kode Item). Penjualan asli
        tidak dihapus, hanya dinetralkan oleh baris retur baru yang bisa diaudit atau dibatalkan
        lewat riwayat import.
      </p>

      <div className="flex gap-3">
        {(["BANDUNG", "CIMAHI"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => {
              setBranch(b);
              reset();
            }}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
              branch === b
                ? "border-accent bg-accent/10 text-accent"
                : "border-border/80 bg-surface-subtle text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {BRANCH_LABEL[b]}
          </button>
        ))}
      </div>

      {!preview && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            id="sales-return-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          <label
            htmlFor="sales-return-file-input"
            className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            {previewLoading ? "Membaca file..." : `Unggah Retur Penjualan ${BRANCH_LABEL[branch]}`}
          </label>
          <p className="text-[11px] text-muted mt-2">
            Format export "Table List" dari POS (.xls / .xlsx) — kolom wajib: No.Retur, Tanggal,
            Nama Customer, Kode Item, Nama Item, Qty, Satuan, Harga, No.Penjualan, Cabang.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {preview && pendingFile && (
        <div className="rounded-xl border border-border/80 bg-surface-subtle/50 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground truncate">{pendingFile.name}</p>
            <span className="text-[11px] font-mono text-muted shrink-0">{BRANCH_LABEL[branch]}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-surface rounded-lg p-2 border border-border/40">
              Total: <strong>{formatNumber(preview.totalRows)}</strong>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-emerald-600 dark:text-emerald-400">
              Baru: <strong>{formatNumber(preview.newCount)}</strong>
            </div>
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-2 text-sky-600 dark:text-sky-400">
              Cocok transaksi asli: <strong>{formatNumber(preview.matchedCount)}</strong>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-amber-600 dark:text-amber-400">
              Tidak cocok: <strong>{formatNumber(preview.unmatchedCount)}</strong>
            </div>
          </div>
          {(preview.duplicateExistingCount > 0 ||
            preview.duplicateInFileCount > 0 ||
            preview.errorCount > 0) && (
            <p className="text-[11px] text-muted">
              {preview.duplicateExistingCount > 0 &&
                `${formatNumber(preview.duplicateExistingCount)} baris sudah pernah diimpor sebelumnya (dilewati). `}
              {preview.duplicateInFileCount > 0 &&
                `${formatNumber(preview.duplicateInFileCount)} baris duplikat dalam file. `}
              {preview.errorCount > 0 && `${formatNumber(preview.errorCount)} baris error dilewati.`}
            </p>
          )}
          {preview.unmatchedCount > 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Baris yang tidak cocok akan tercatat dengan pegawai "Tidak diketahui" — cek apakah
              penjualan aslinya sudah diimpor.
            </p>
          )}
          {preview.newSample.length > 0 && (
            <details className="text-[11px]">
              <summary className="cursor-pointer font-medium text-foreground hover:text-accent">
                Lihat contoh baris baru ({formatNumber(preview.newSample.length)} dari{" "}
                {formatNumber(preview.newCount)})
              </summary>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border/60">
                <table className="w-full text-[11px]">
                  <thead className="bg-surface text-muted text-left sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">No.Retur</th>
                      <th className="px-2.5 py-1.5 font-semibold">Item</th>
                      <th className="px-2.5 py-1.5 font-semibold">Qty</th>
                      <th className="px-2.5 py-1.5 font-semibold">Pegawai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 bg-surface/60">
                    {preview.newSample.map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="px-2.5 py-1.5 font-mono">{r.noRetur}</td>
                        <td className="px-2.5 py-1.5 text-foreground">{r.namaItem}</td>
                        <td className="px-2.5 py-1.5">{r.qty}</td>
                        <td className={r.matched ? "px-2.5 py-1.5" : "px-2.5 py-1.5 text-amber-600 dark:text-amber-400"}>
                          {r.employeeName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={confirmBusy}
              onClick={handleConfirmImport}
              className="rounded-lg bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs disabled:opacity-60"
            >
              {confirmBusy ? "Menyimpan..." : "Konfirmasi Import"}
            </button>
            <button
              type="button"
              disabled={confirmBusy}
              onClick={reset}
              className="rounded-lg border border-border/80 px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-hover transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          Berhasil: {formatNumber(result.insertedCount)} baris retur diimpor (
          {formatNumber(result.matchedCount)} cocok transaksi asli,{" "}
          {formatNumber(result.unmatchedCount)} tidak cocok), {formatNumber(result.duplicateCount)}{" "}
          duplikat dilewati.
        </div>
      )}
    </div>
  );
}
