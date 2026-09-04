import * as XLSX from "xlsx";

export interface ParsedSaleRow {
  noTransaksi: string;
  tanggal: Date; // UTC midnight, date-only
  jamBuat: string; // "HH:MM:SS"
  cabang: string;
  customer: string;
  kodeItem: string;
  namaItem: string;
  itemGroup: string | null;
  qty: number;
  unit: string;
  hargaJual: number;
  diskon: number;
  subtotal: number;
  hpp: number;
  labaRugi: number;
  pegawai: string;
}

export interface RowError {
  rowNumber: number; // 1-indexed, matches the row number in Excel (header = 1)
  message: string;
  /** Snapshot of whatever fields were readable before the error — for manual investigation. */
  rawSnapshot?: {
    noTransaksi: string;
    tanggal: string;
    cabang: string;
    kodeItem: string;
    namaItem: string;
    qty: string;
    pegawai: string;
  };
}

export interface ParseResult {
  rows: ParsedSaleRow[];
  errors: RowError[];
  totalRows: number;
}

// Column names as exported by the POS system. If the export template ever
// changes, this is the single place to update.
const REQUIRED_HEADERS = [
  "No Transaksi",
  "Tanggal",
  "Jam Buat",
  "Cabang",
  "Kode Item",
  "Nama Item",
  "qty",
  "unit",
  "Harga Jual",
  "Diskon",
  "Subtotal",
  "HPP",
  "Laba Rugi",
  "Pegawai",
];

export function parseExcelBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
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
      `Kolom berikut tidak ditemukan di file: ${missing.join(", ")}. Pastikan format export sesuai template.`
    );
  }

  const rows: ParsedSaleRow[] = [];
  const errors: RowError[] = [];

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2; // header is row 1
    try {
      rows.push(toSaleRow(r));
    } catch (err) {
      const rawTanggal =
        r["Tanggal"] instanceof Date
          ? (r["Tanggal"] as Date).toISOString().slice(0, 10)
          : String(r["Tanggal"] ?? "");
      errors.push({
        rowNumber,
        message: err instanceof Error ? err.message : "Baris tidak valid",
        rawSnapshot: {
          noTransaksi: str(r["No Transaksi"]),
          tanggal: rawTanggal,
          cabang: str(r["Cabang"]),
          kodeItem: str(r["Kode Item"]),
          namaItem: str(r["Nama Item"]),
          qty: r["qty"] != null ? String(r["qty"]) : "",
          pegawai: str(r["Pegawai"]),
        },
      });
    }
  });

  return { rows, errors, totalRows: raw.length };
}

function toSaleRow(r: Record<string, unknown>): ParsedSaleRow {
  const noTransaksi = str(r["No Transaksi"]);
  const tanggal = toDate(r["Tanggal"]);
  const cabang = str(r["Cabang"]);
  const kodeItem = str(r["Kode Item"]);
  const namaItem = str(r["Nama Item"]);
  const qty = toRequiredNumber(r["qty"], "qty");

  if (!noTransaksi) throw new Error("No Transaksi kosong");
  if (!tanggal) throw new Error("Tanggal tidak valid / tidak bisa dibaca");
  // cabang boleh kosong — akan diinferensikan dari riwayat pegawai di importSales.ts
  if (!kodeItem) throw new Error("Kode Item kosong");
  if (!namaItem) throw new Error("Nama Item kosong");

  const itemGroupRaw = r["Item Group"];
  const itemGroup =
    itemGroupRaw === null || itemGroupRaw === undefined || String(itemGroupRaw).trim() === ""
      ? null
      : String(itemGroupRaw).trim();

  return {
    noTransaksi,
    tanggal,
    jamBuat: toTimeString(r["Jam Buat"]),
    cabang,
    customer: str(r["Customer"]),
    kodeItem,
    namaItem,
    itemGroup,
    qty,
    unit: str(r["unit"]) || "PCS",
    hargaJual: toNumber(r["Harga Jual"]),
    diskon: toNumber(r["Diskon"]),
    subtotal: toNumber(r["Subtotal"]),
    hpp: toNumber(r["HPP"]),
    labaRugi: toNumber(r["Laba Rugi"]),
    pegawai: str(r["Pegawai"]) || "Tidak diketahui",
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

function toTimeString(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().substring(11, 19);
  }
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) {
    const fraction = v - Math.floor(v);
    const totalSeconds = Math.round(fraction * 86400);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return "00:00:00";
}
