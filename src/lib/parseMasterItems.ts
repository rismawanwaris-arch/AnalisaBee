import * as XLSX from "xlsx";

export interface ParsedMasterItemRow {
  rowNumber: number; // 1-indexed, matches the row number in Excel (header = 1)
  code: string;
  name: string;
  itemGroup: string | null;
  brand: string | null;
}

export interface MasterItemRowError {
  rowNumber: number;
  message: string;
}

export interface MasterItemParseResult {
  rows: ParsedMasterItemRow[];
  errors: MasterItemRowError[];
  duplicateInFileCount: number;
  totalRows: number;
}

// Column names as exported by the POS "Table List" master item report. Only
// Kode Item and Nama Item are required — Item Grup and Merk are read when
// present but their absence doesn't fail the whole file. "Merk" in
// particular isn't part of the raw POS export at all — it's a column the
// owner adds on top of it to power the brand filter on Performa Outlet.
const REQUIRED_HEADERS = ["Kode Item", "Nama Item"];

export function parseMasterItemBuffer(buffer: Buffer): MasterItemParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
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
      `Kolom berikut tidak ditemukan di file: ${missing.join(", ")}. Pastikan format export "Table List" dari POS.`
    );
  }

  const rows: ParsedMasterItemRow[] = [];
  const errors: MasterItemRowError[] = [];
  const seenCodes = new Set<string>();
  let duplicateInFileCount = 0;

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const code = str(r["Kode Item"]);
    const name = str(r["Nama Item"]);
    const itemGroupRaw = r["Item Grup"];
    const itemGroup =
      itemGroupRaw === null || itemGroupRaw === undefined || String(itemGroupRaw).trim() === ""
        ? null
        : String(itemGroupRaw).trim();
    const brandRaw = r["Merk"];
    const brand =
      brandRaw === null || brandRaw === undefined || String(brandRaw).trim() === ""
        ? null
        : String(brandRaw).trim();

    if (!code) {
      errors.push({ rowNumber, message: "Kode Item kosong" });
      return;
    }
    if (!name) {
      errors.push({ rowNumber, message: "Nama Item kosong" });
      return;
    }
    if (seenCodes.has(code)) {
      duplicateInFileCount++;
      return; // first occurrence in the file wins
    }
    seenCodes.add(code);
    rows.push({ rowNumber, code, name, itemGroup, brand });
  });

  return { rows, errors, duplicateInFileCount, totalRows: raw.length };
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
