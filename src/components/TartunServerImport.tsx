
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
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

export function TartunServerImport() {
  const [date, setDate] = useState(yesterdayStr());

  return (
    <div className="rounded border border-border bg-surface p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Data Tambahan: Tarik Tunai &amp; Server/Voucher
        </h2>
        <p className="text-sm text-muted mt-1">
          Dipakai oleh laporan{" "}
          <Link to="/target" className="underline text-accent">
            Target Harian
          </Link>
          . Setiap sumber sudah berupa ringkasan per outlet per hari — mengunggah ulang tanggal
          yang sama akan menimpa angkanya, bukan menambah baris baru.
        </p>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Tanggal Data</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TartunCard date={date} />
        <ServerCard date={date} />
      </div>
    </div>
  );
}

function ResultSummary({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm space-y-1.5">
      <div className="font-medium text-foreground">{result.filename}</div>
      <div className="text-muted">
        {formatNumber(result.parsedRows)} baris dibaca · {formatNumber(result.matchedOutletCount)}{" "}
        outlet cocok
      </div>
      <div className="text-muted">
        Total: {formatRupiah(result.totalSales)} · {formatNumber(result.totalTrx)} transaksi
      </div>
      {result.unmatchedNames.length > 0 && (
        <details className="text-negative">
          <summary className="cursor-pointer">
            {result.unmatchedNames.length} nama tidak cocok outlet manapun
          </summary>
          <ul className="mt-1 pl-4 list-disc">
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

function TartunCard({ date }: { date: string }) {
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
      else setResult(data);
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground mb-1">Data Tarik Tunai</h3>
      <p className="text-xs text-muted mb-3">Format: .xls/.xlsx (ringkasan_outlet.xlsx)</p>
      <input
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:text-accent-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:opacity-90"
      />
      {busy && <p className="text-sm text-muted mt-2">Memproses...</p>}
      {error && <p className="text-sm text-negative mt-2">{error}</p>}
      {result && (
        <div className="mt-3">
          <ResultSummary result={result} />
        </div>
      )}
    </div>
  );
}

function ServerCard({ date }: { date: string }) {
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
      else setResult(data);
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
      else setResult(data);
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground mb-1">Data Komisi Server</h3>
      <p className="text-xs text-muted mb-3">Tempel teks tab-separated, atau unggah file.</p>

      <div className="flex gap-1 mb-3">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`px-2.5 py-1 rounded text-xs font-medium ${mode === "paste" ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-hover"}`}
        >
          Tempel Teks
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`px-2.5 py-1 rounded text-xs font-medium ${mode === "file" ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-hover"}`}
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
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
          />
          <button
            type="button"
            onClick={submitText}
            disabled={busy || !text.trim()}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Memproses..." : "Proses Teks"}
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
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:text-accent-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:opacity-90"
        />
      )}

      {error && <p className="text-sm text-negative mt-2">{error}</p>}
      {result && (
        <div className="mt-3">
          <ResultSummary result={result} />
        </div>
      )}
    </div>
  );
}
