import { useState, useRef, useId } from "react";
import * as XLSX from "xlsx";
import { parseExcelPointRows, type ParsedPointItem } from "@/lib/parsePointExcel";
import { formatNumber } from "@/lib/format";

interface PointRulesExcelImportProps {
  onSuccess: () => Promise<void> | void;
  onClose?: () => void;
}

export function PointRulesExcelImport({ onSuccess, onClose }: PointRulesExcelImportProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Paste state
  const [pasteText, setPasteText] = useState("");
  
  // Parsed items & preview
  const [parsedItems, setParsedItems] = useState<ParsedPointItem[]>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; reason: string }[]>([]);
  const [searchPreview, setSearchPreview] = useState("");
  
  // Submission state
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawStartDateInputId = useId();
  const startDateInputId = `startdate-${rawStartDateInputId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Helper to parse file
  function handleFile(file: File) {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setErrorMsg("File Excel tidak memiliki lembar kerja (sheet).");
          setParsedItems([]);
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const result = parseExcelPointRows(rawRows);
        setParsedItems(result.items);
        setParseErrors(result.errors);
        if (result.items.length === 0) {
          setErrorMsg("Tidak ada data item dan poin yang valid ditemukan dalam file.");
        }
      } catch (err: any) {
        setErrorMsg("Gagal membaca file Excel: " + (err.message || "format tidak valid"));
        setParsedItems([]);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Gagal membaca file dari perangkat.");
    };
    reader.readAsArrayBuffer(file);
  }

  // Helper to parse pasted text
  function handlePasteChange(text: string) {
    setPasteText(text);
    setErrorMsg(null);
    setSuccessMsg(null);

    const lines = text.split("\n");
    const rawRows = lines.map((line) => line.split(/[\t,;]+/).map((c) => c.trim()));
    const result = parseExcelPointRows(rawRows);
    setParsedItems(result.items);
    setParseErrors(result.errors);
  }

  // Template download
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Nama Barang", "Point Lama", "Point Baru"],
      ["Batok UI ME PC08 USB Type C", 50, 75],
      ["TWS UFONE EB04", 50, 60],
      ["TWS UFONE EB05", 30, 50],
      ["Charger Robot RT-A20L C TO L", 15, 20],
      ["Kabel Data ufone CB02-CL / CB01-CL", 10, 20],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Auto-fit column widths
    ws["!cols"] = [{ wch: 38 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Update Poin");
    XLSX.writeFile(wb, "template_update_poin.xlsx");
  }

  // Submit to server
  async function handleSubmit() {
    if (parsedItems.length === 0) {
      setErrorMsg("Belum ada data item dan poin yang valid untuk disimpan.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/points/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          items: parsedItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal menyimpan data poin.");
        return;
      }

      setSuccessMsg(`✓ Berhasil memperbarui ${data.count} aturan poin berlaku mulai ${startDate}!`);
      setParsedItems([]);
      setSelectedFile(null);
      setPasteText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onSuccess();
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat menyimpan data.");
    } finally {
      setBusy(false);
    }
  }

  const filteredPreview = parsedItems.filter((i) =>
    i.pattern.toLowerCase().includes(searchPreview.toLowerCase())
  );

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-4 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>📊 Sistem Upload Data Poin dari Excel</span>
          </h4>
          <p className="text-xs text-muted mt-0.5">
            Unggah file spreadsheet atau salin data tabel untuk memperbarui poin SKU secara massal dengan tanggal berlaku.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-all shadow-xs"
          >
            📥 Unduh Template Excel
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted hover:text-foreground p-1.5 transition-colors"
              title="Tutup form"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Date Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-surface-subtle p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "upload"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            📁 Unggah File (.xlsx / .xls / .csv)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "paste"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            📋 Salin &amp; Tempel Teks
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={startDateInputId} className="text-xs font-semibold text-muted">
            Berlaku Mulai Tanggal:
          </label>
          <input
            id={startDateInputId}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
      </div>

      {/* Tab 1: File Upload */}
      {activeTab === "upload" && (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? "border-accent bg-accent/10"
                : "border-border/80 bg-surface/50 hover:bg-surface-hover/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">📑</span>
              <p className="text-xs font-semibold text-foreground">
                {selectedFile ? selectedFile.name : "Klik atau seret file Excel (.xlsx, .xls, .csv) ke sini"}
              </p>
              <p className="text-[11px] text-muted">
                Format kolom yang didukung: <code>Nama Barang &nbsp;|&nbsp; Point Lama &nbsp;|&nbsp; Point Baru</code> atau <code>Nama Barang &nbsp;|&nbsp; Point Baru</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Copy-Paste */}
      {activeTab === "paste" && (
        <div className="space-y-2">
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => handlePasteChange(e.target.value)}
            placeholder={`Salin baris dari Excel dan tempel di sini, contoh:\nBatok UI ME PC08 USB Type C\t50\t75\nTWS UFONE EB04\t50\t60\nTWS UFONE EB05\t30\t50`}
            className="w-full rounded-lg border border-border/80 bg-surface p-3 text-xs font-mono text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <p className="text-[11px] text-muted">
            Tip: Anda bisa menyeleksi tabel di Excel, lalu tekan <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">Ctrl+C</kbd> / <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">Cmd+C</kbd> dan langsung tempel ke kotak di atas.
          </p>
        </div>
      )}

      {/* Warnings & Errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">Perhatian: {parseErrors.length} baris tidak dapat diproses:</p>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
            {parseErrors.slice(0, 4).map((err, idx) => (
              <li key={idx}>Baris {err.row}: {err.reason}</li>
            ))}
            {parseErrors.length > 4 && <li>...dan {parseErrors.length - 4} baris lainnya.</li>}
          </ul>
        </div>
      )}

      {errorMsg && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</p>}
      {successMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{successMsg}</p>}

      {/* Preview Section */}
      {parsedItems.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-accent">
                ✓ {parsedItems.length} aturan item terdeteksi
              </span>
              <span className="text-[11px] text-muted font-mono">
                (Berlaku mulai: {startDate})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchPreview}
                onChange={(e) => setSearchPreview(e.target.value)}
                placeholder="Cari item di hasil..."
                className="rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1 text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                {busy ? "Menyimpan..." : `Simpan ${parsedItems.length} Aturan Poin`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/80 bg-surface max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle text-muted text-left sticky top-0 border-b border-border/80">
                <tr>
                  <th className="px-3 py-1.5 font-semibold text-[11px] uppercase w-10 text-center">No</th>
                  <th className="px-3 py-1.5 font-semibold text-[11px] uppercase">Nama / Pola Item</th>
                  <th className="px-3 py-1.5 font-semibold text-[11px] uppercase text-right">Poin Baru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono">
                {filteredPreview.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover/50">
                    <td className="px-3 py-1.5 text-center text-muted font-sans">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-sans font-medium text-foreground">{item.pattern}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-accent">+{formatNumber(item.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
