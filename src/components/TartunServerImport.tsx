import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah, formatDate } from "@/lib/format";
import { yesterdayStr } from "@/lib/dateDefaults";

interface ImportResult {
  filename: string;
  parsedRows: number;
  parseErrors: { rowNumber: number; message: string }[];
  matchedOutletCount: number;
  unmatchedNames: string[];
  totalSales: number;
  totalTrx: number;
}

interface DailyHistoryItem {
  tanggal: string;
  outletCount: number;
  totalSales: number;
  totalTrx: number;
  updatedAt: string | null;
}

export function TartunServerImport() {
  const [date, setDate] = useState(yesterdayStr());
  const [tartunHistory, setTartunHistory] = useState<DailyHistoryItem[]>([]);
  const [serverHistory, setServerHistory] = useState<DailyHistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    const [t, s] = await Promise.all([
      fetch("/api/daily-imports/tartun").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/daily-imports/server").then((r) => (r.ok ? r.json() : [])),
    ]);
    setTartunHistory(t);
    setServerHistory(s);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-5 shadow-xs">
      <div>
        <h2 className="text-base font-bold text-foreground">
          Data Tambahan: Tarik Tunai &amp; Server/Voucher
        </h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Dipakai oleh laporan{" "}
          <Link to="/target" className="underline text-accent">
            Target Harian
          </Link>
          . Setiap sumber sudah berupa ringkasan per outlet per hari — mengunggah ulang tanggal
          yang sama akan menimpa angkanya, bukan menambah baris baru.
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
          Tanggal Data
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TartunCard date={date} onImported={loadHistory} />
        <ServerCard date={date} onImported={loadHistory} />
      </div>

      {/* History Tables */}
      <div className="grid md:grid-cols-2 gap-4 pt-1">
        <DailyHistoryTable
          title="Riwayat Tarik Tunai"
          type="tartun"
          rows={tartunHistory}
          onDeleted={loadHistory}
        />
        <DailyHistoryTable
          title="Riwayat Komisi Server"
          type="server"
          rows={serverHistory}
          onDeleted={loadHistory}
        />
      </div>
    </div>
  );
}

function DailyHistoryTable({
  title,
  type,
  rows,
  onDeleted,
}: {
  title: string;
  type: "tartun" | "server";
  rows: DailyHistoryItem[];
  onDeleted: () => void;
}) {
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const visibleRows = rows.slice(0, 10);

  async function confirmDelete(tanggal: string) {
    setBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/daily-imports/${type}/${tanggal}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Gagal menghapus.");
        return;
      }
      setDeletingDate(null);
      onDeleted();
    } catch {
      setDeleteError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
        {title}
        <span className="ml-2 font-mono font-normal text-muted text-[10px]">
          {rows.length} tanggal tersimpan
        </span>
      </h3>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted">
          Belum ada data yang diimport.
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 overflow-hidden shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle/70 text-muted border-b border-border/80">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[11px] uppercase">Tanggal</th>
                <th className="px-3 py-2 text-right font-semibold text-[11px] uppercase">Outlet</th>
                <th className="px-3 py-2 text-right font-semibold text-[11px] uppercase">Total</th>
                <th className="px-3 py-2 text-right font-semibold text-[11px] uppercase">Diupdate</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visibleRows.map((r) => (
                <tr key={r.tanggal} className="hover:bg-surface-hover/60 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium text-foreground">
                    {r.tanggal}
                  </td>
                  <td className="px-3 py-2 text-right text-muted font-mono">
                    {formatNumber(r.outletCount)}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground font-mono">
                    {formatRupiah(r.totalSales)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted">
                    {r.updatedAt ? formatDate(r.updatedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {deletingDate === r.tanggal ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {deleteError && (
                          <span className="text-rose-500 text-[10px]">{deleteError}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => { setDeletingDate(null); setDeleteError(null); }}
                          disabled={busy}
                          className="text-[11px] text-muted hover:text-foreground px-2 py-0.5 rounded border border-border/80 hover:bg-surface-hover transition-colors disabled:opacity-40"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDelete(r.tanggal)}
                          disabled={busy}
                          className="text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
                        >
                          {busy ? "Menghapus…" : "Hapus"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setDeletingDate(r.tanggal); setDeleteError(null); }}
                        className="text-[11px] text-muted hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-500/10"
                        title={`Hapus data ${type} tanggal ${r.tanggal}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > visibleRows.length && (
            <div className="px-3 py-2 text-[11px] text-muted text-center border-t border-border/60 bg-surface-subtle/40">
              Menampilkan 10 tanggal terbaru dari {rows.length}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSummary({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-1">
      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
        ✓ {result.filename} berhasil diproses
      </div>
      <div className="text-muted">
        {formatNumber(result.parsedRows)} baris · {formatNumber(result.matchedOutletCount)} outlet cocok
        · Total {formatRupiah(result.totalSales)} · {formatNumber(result.totalTrx)} trx
      </div>
      {result.unmatchedNames.length > 0 && (
        <details className="text-rose-600 dark:text-rose-400">
          <summary className="cursor-pointer font-medium">
            {result.unmatchedNames.length} nama tidak cocok ke outlet mana pun
          </summary>
          <ul className="mt-1 pl-4 list-disc space-y-0.5">
            {result.unmatchedNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-1 text-muted">
            Tambahkan mapping di{" "}
            <Link to="/settings?tab=target" className="underline text-accent">
              Pengaturan
            </Link>
            .
          </p>
        </details>
      )}
    </div>
  );
}

function TartunCard({ date, onImported }: { date: string; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("date", date);
      const res = await fetch("/api/import/tartun", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Gagal memproses file.");
      else { setResult(data); onImported(); }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-4 space-y-3">
      <div>
        <h3 className="text-xs font-bold text-foreground">Data Tarik Tunai</h3>
        <p className="text-[11px] text-muted mt-0.5">Format: .xls/.xlsx (ringkasan_outlet.xlsx)</p>
      </div>
      <input
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:text-accent-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:opacity-90 file:cursor-pointer"
      />
      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Memproses...
        </div>
      )}
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
      {result && <ResultSummary result={result} />}
    </div>
  );
}

function ServerCard({ date, onImported }: { date: string; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [text, setText] = useState("");

  async function submitText() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("date", date);
      const res = await fetch("/api/import/server", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Gagal memproses data.");
      else { setResult(data); onImported(); }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("date", date);
      const res = await fetch("/api/import/server", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Gagal memproses file.");
      else { setResult(data); onImported(); }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-4 space-y-3">
      <div>
        <h3 className="text-xs font-bold text-foreground">Data Komisi Server</h3>
        <p className="text-[11px] text-muted mt-0.5">Tempel teks tab-separated, atau unggah file.</p>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${mode === "paste" ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-hover"}`}
        >
          Tempel Teks
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${mode === "file" ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-hover"}`}
        >
          Upload File
        </button>
      </div>

      {mode === "paste" ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Kode Reseller\tNama\tJml. Data\tGrup\tJml. Komisi\tUpline..."}
            rows={4}
            className="w-full rounded-lg border border-border/80 bg-surface px-3 py-2 text-[11px] font-mono text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
          <button
            type="button"
            onClick={submitText}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all disabled:opacity-40 shadow-xs"
          >
            {busy ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memproses...
              </>
            ) : "Proses Teks"}
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) submitFile(file);
            e.target.value = "";
          }}
          className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:text-accent-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:opacity-90 file:cursor-pointer"
        />
      )}

      {busy && mode !== "paste" && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Memproses...
        </div>
      )}
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
      {result && <ResultSummary result={result} />}
    </div>
  );
}
