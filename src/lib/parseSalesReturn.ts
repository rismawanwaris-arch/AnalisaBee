import * as XLSX from "xlsx";

export interface ParsedReturRow {
  noRetur: string;
  tanggal: Date; // UTC midnight, date-only
  customer: string;
  kodeItem: string;
  namaItem: string;
  qty: number;
  unit: string;
  harga: number;
  noPenjualan: string; // == Sale.noTransaksi when the return references an existing sale
  cabang: string; // outlet name — from the "Cabang" column, NOT "Gudang"
}

export interface ReturRowError {
  rowNumber: number; // 1-indexed, matches the row number in Excel (header = 1)
  message: string;
  /** Snapshot of whatever fields were readable before the error — for manual investigation. */
  rawSnapshot?: {
    noRetur: string;
    tanggal: string;
    cabang: string;
    kodeItem: string;
    namaItem: string;
    qty: string;
    noPenjualan: string;
  };
}

export interface ReturParseResult {
  rows: ParsedReturRow[];
  errors: ReturRowError[];
  totalRows: number;
}

// Column names as exported by the POS system ("Table List" sheet). If the
// export template ever changes, this is the single place to update.
const REQUIRED_HEADERS = [
  "No.Retur",
  "Tanggal",
  "Nama Customer",
  "Kode Item",
  "Nama Item",
  "Qty",
  "Satuan",
  "Harga",
  "No.Penjualan",
  "Cabang",
];

export function parseSalesReturnBuffer(buffer: Buffer): ReturParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames.find((n) => n === "Table List") ?? workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("File Excel tidak berisi sheet apapun.");
  }
  const sheet = workbook.Sheets[sheetName];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: true,
  });

  if (raw.length === 0) {
    throw new Error("Sheet pertama kosong, tidak ada baris data.");
  }

  const headers = Object.keys(raw[0]);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `Kolom berikut tidak ditemukan di file: ${missing.join(", ")}. Pastikan format export sesuai template retur penjualan.`
    );
  }

  const rows: ParsedReturRow[] = [];
  const errors: ReturRowError[] = [];

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2; // header is row 1
    try {
      rows.push(toReturRow(r));
    } catch (err) {
      const rawTanggal =
        r["Tanggal"] instanceof Date
          ? (r["Tanggal"] as Date).toISOString().slice(0, 10)
          : String(r["Tanggal"] ?? "");
      errors.push({
        rowNumber,
        message: err instanceof Error ? err.message : "Baris tidak valid",
        rawSnapshot: {
          noRetur: str(r["No.Retur"]),
          tanggal: rawTanggal,
          cabang: str(r["Cabang"]),
          kodeItem: str(r["Kode Item"]),
          namaItem: str(r["Nama Item"]),
          qty: r["Qty"] != null ? String(r["Qty"]) : "",
          noPenjualan: str(r["No.Penjualan"]),
        },
      });
    }
  });

  return { rows, errors, totalRows: raw.length };
}

function toReturRow(r: Record<string, unknown>): ParsedReturRow {
  const noRetur = str(r["No.Retur"]);
  const tanggal = toDate(r["Tanggal"]);
  const cabang = str(r["Cabang"]);
  const kodeItem = str(r["Kode Item"]);
  const namaItem = str(r["Nama Item"]);
  const qty = toRequiredNumber(r["Qty"], "Qty");

  if (!noRetur) throw new Error("No.Retur kosong");
  if (!tanggal) throw new Error("Tanggal tidak valid / tidak bisa dibaca");
  if (!cabang) throw new Error("Cabang kosong");
  if (!kodeItem) throw new Error("Kode Item kosong");
  if (!namaItem) throw new Error("Nama Item kosong");

  return {
    noRetur,
    tanggal,
    customer: str(r["Nama Customer"]),
    kodeItem,
    namaItem,
    qty,
    unit: str(r["Satuan"]) || "PCS",
    harga: toNumber(r["Harga"]),
    noPenjualan: str(r["No.Penjualan"]),
    cabang,
  };
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toRequiredNumber(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`${field} tidak valid`);
}

/** Days between the Excel epoch (1899-12-30) and Unix epoch, for the numeric-serial fallback. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

function toDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const utcDays = Math.floor(v) - EXCEL_EPOCH_OFFSET_DAYS;
    const ms = utcDays * 86400 * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
  }
  if (typeof v === "string" && v.trim()) {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    }
  }
  return null;
}
