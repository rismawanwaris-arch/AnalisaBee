import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

type Branch = "BANDUNG" | "CIMAHI";

const BRANCH_LABEL: Record<Branch, string> = {
  BANDUNG: "Cabang Bandung",
  CIMAHI: "Cabang Cimahi",
};

interface MasterItemSummary {
  total: number;
  unofficial: number;
}

interface MasterItemChangeRow {
  rowNumber: number;
  code: string;
  name: string;
  itemGroup: string | null;
  status: "NEW" | "UPDATE";
  previousName?: string;
  previousItemGroup?: string | null;
}

interface MasterItemPreview {
  branch: Branch;
  totalRows: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  errors: { rowNumber: number; message: string }[];
  changes: MasterItemChangeRow[];
}

interface MasterItemImportResult {
  branch: Branch;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  duplicateInFileCount: number;
  errorCount: number;
}

export function MasterItemImport() {
  const [branch, setBranch] = useState<Branch>("BANDUNG");
  const [summary, setSummary] = useState<Record<Branch, MasterItemSummary> | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MasterItemPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [result, setResult] = useState<MasterItemImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/master-items/summary");
      if (res.ok) setSummary(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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
      const res = await fetch("/api/settings/master-items/preview", { method: "POST", body: formData });
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
      const res = await fetch("/api/settings/master-items/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengimpor file.");
      } else {
        setResult(data);
        setPendingFile(null);
        setPreview(null);
        await loadSummary();
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat mengunggah file.");
    } finally {
      setConfirmBusy(false);
    }
  }

  const currentSummary = summary?.[branch];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted leading-relaxed">
        Daftar resmi kode &amp; nama item per cabang — sumber kebenaran yang dipakai import
        penjualan untuk mencocokkan kode item, bukan lagi menebak dari nama di file transaksi.
        Setiap cabang punya definisinya sendiri, jadi kode yang sama boleh berarti barang berbeda
        di Bandung dan Cimahi. Unggah ulang file ini kapan pun ada item baru atau nama/kategori
        yang berubah — baris yang sudah sama persis tidak akan disentuh.
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

      {currentSummary && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-mono text-foreground bg-surface-subtle border border-border/60 rounded px-2 py-0.5">
            {formatNumber(currentSummary.total)} item terdaftar
          </span>
          {currentSummary.unofficial > 0 && (
            <span className="font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
              {formatNumber(currentSummary.unofficial)} belum resmi (dari transaksi, belum ada di master)
            </span>
          )}
        </div>
      )}

      {!preview && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            id="master-item-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          <label
            htmlFor="master-item-file-input"
            className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            {previewLoading ? "Membaca file..." : `Unggah Master Item ${BRANCH_LABEL[branch]}`}
          </label>
          <p className="text-[11px] text-muted mt-2">
            Format export "Table List" dari POS (.xls / .xlsx) — kolom wajib: Kode Item, Nama Item.
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
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-amber-600 dark:text-amber-400">
              Diperbarui: <strong>{formatNumber(preview.updateCount)}</strong>
            </div>
            <div className="bg-surface rounded-lg p-2 border border-border/40 text-muted">
              Tidak berubah: <strong>{formatNumber(preview.unchangedCount)}</strong>
            </div>
          </div>
          {(preview.duplicateInFileCount > 0 || preview.errorCount > 0) && (
            <p className="text-[11px] text-muted">
              {preview.duplicateInFileCount > 0 &&
                `${formatNumber(preview.duplicateInFileCount)} kode duplikat dalam file (baris pertama dipakai). `}
              {preview.errorCount > 0 &&
                `${formatNumber(preview.errorCount)} baris error dilewati.`}
            </p>
          )}
          {preview.changes.length > 0 && (
            <details className="text-[11px]">
              <summary className="cursor-pointer font-medium text-foreground hover:text-accent">
                Lihat detail perubahan ({formatNumber(preview.changes.length)})
              </summary>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border/60">
                <table className="w-full text-[11px]">
                  <thead className="bg-surface text-muted text-left sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Kode</th>
                      <th className="px-2.5 py-1.5 font-semibold">Nama</th>
                      <th className="px-2.5 py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 bg-surface/60">
                    {preview.changes.map((c) => (
                      <tr key={c.rowNumber}>
                        <td className="px-2.5 py-1.5 font-mono">{c.code}</td>
                        <td className="px-2.5 py-1.5">
                          {c.status === "UPDATE" && c.previousName !== c.name ? (
                            <>
                              <span className="line-through text-muted/70">{c.previousName}</span>
                              {" → "}
                              <span className="text-foreground font-medium">{c.name}</span>
                            </>
                          ) : (
                            <span className="text-foreground font-medium">{c.name}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <span
                            className={
                              c.status === "NEW"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {c.status === "NEW" ? "Baru" : "Diperbarui"}
                          </span>
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
          Berhasil: {formatNumber(result.createdCount)} item baru, {formatNumber(result.updatedCount)}{" "}
          diperbarui, {formatNumber(result.unchangedCount)} tidak berubah untuk {BRANCH_LABEL[result.branch]}.
        </div>
      )}
    </div>
  );
}
