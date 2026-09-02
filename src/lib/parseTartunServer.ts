import * as XLSX from "xlsx";

export interface TartunServerRow {
  rowNumber: number;
  name: string;
  sales: number;
  trx: number;
}

export interface RowError {
  rowNumber: number;
  message: string;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(/,/g, ".").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseSheet(
  buffer: Buffer,
  nameKeys: string[],
  salesKeys: string[],
  trxKeys: string[]
): { rows: TartunServerRow[]; errors: RowError[] } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File Excel tidak berisi sheet apapun.");
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: null,
    raw: true,
  });

  const rows: TartunServerRow[] = [];
  const errors: RowError[] = [];

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2;
    const name = str(nameKeys.map((k) => r[k]).find((v) => v !== null && v !== undefined && v !== ""));
    if (!name) {
      errors.push({ rowNumber, message: "Nama outlet/reseller kosong" });
      return;
    }
    const sales = toNumber(salesKeys.map((k) => r[k]).find((v) => v !== null && v !== undefined));
    const trx = toNumber(trxKeys.map((k) => r[k]).find((v) => v !== null && v !== undefined));
    rows.push({ rowNumber, name, sales, trx });
  });

  return { rows, errors };
}

/** Tarik Tunai export — expects "Nama Pengguna"/"Nama", "Admin"/"Total Biaya Admin", "Transaksi"/"Jml. Data". */
export function parseTartunBuffer(buffer: Buffer) {
  return parseSheet(
    buffer,
    ["Nama Pengguna", "Nama"],
    ["Admin", "Total Biaya Admin"],
    ["Transaksi", "Jml. Data"]
  );
}

/** Server/voucher commission export — expects "Nama", "Jml. Komisi"/"Komisi", "Jml. Data"/"Transaksi". */
export function parseServerBuffer(buffer: Buffer) {
  return parseSheet(
    buffer,
    ["Nama", "Nama Pengguna"],
    ["Jml. Komisi", "Komisi"],
    ["Jml. Data", "Transaksi"]
  );
}

/** Tab-separated paste: "Kode Reseller  Nama  Jml. Data  Grup  Jml. Komisi  Upline". */
export function parseServerText(text: string): { rows: TartunServerRow[]; errors: RowError[] } {
  const lines = text.trim().split("\n");
  const rows: TartunServerRow[] = [];
  const errors: RowError[] = [];
  if (lines.length < 2) return { rows, errors };

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cols = lines[i].split("\t");
    if (cols.length < 5) {
      errors.push({ rowNumber, message: "Kolom kurang dari 5 (butuh tab-separated)" });
      continue;
    }
    const name = cols[1]?.trim();
    if (!name) {
      errors.push({ rowNumber, message: "Nama reseller kosong" });
      continue;
    }
    const trx = parseInt(cols[2]?.trim(), 10) || 0;
    const komisiStr = (cols[4] || "").trim().replace(/\./g, "");
    const sales = parseFloat(komisiStr) || 0;
    rows.push({ rowNumber, name, sales, trx });
  }
  return { rows, errors };
}
