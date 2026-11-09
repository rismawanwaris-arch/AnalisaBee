import * as XLSX from "xlsx";

export interface ParsedSpPointRow {
  rowNumber: number;
  noPenjualan: string;
  namaBarang: string;
  qty: number;
  points: number;
}

export interface ParseSpPointsResult {
  rows: ParsedSpPointRow[];
  errors: { rowNumber: number; message: string }[];
}

function normalizeHeader(val: unknown): string {
  if (val == null) return "";
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[._\-/\\]+/g, " ")
    .replace(/\s+/g, " ");
}

export function parseSpPointsBuffer(buffer: Buffer | ArrayBuffer): ParseSpPointsResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowNumber: 0, message: "File Excel kosong." }] };
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Sheet Excel tidak ditemukan." }] };
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (rawRows.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Sheet Excel tidak memiliki data." }] };
  }

  // Find header row (first row that contains "penjualan" or "transaksi" or "barang" or "point")
  let headerRowIndex = -1;
  let colNoPenjualan = -1;
  let colNamaBarang = -1;
  let colQty = -1;
  let colPoint = -1;

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] as unknown[];
    if (!Array.isArray(row)) continue;

    let noIdx = -1;
    let itemIdx = -1;
    let qtyIdx = -1;
    let ptIdx = -1;

    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeader(row[c]);
      if (!h) continue;

      if (
        noIdx === -1 &&
        (h.includes("penjualan") ||
          h.includes("transaksi") ||
          h.includes("struk") ||
          h.includes("invoice") ||
          h === "no" ||
          h === "nomor")
      ) {
        noIdx = c;
      } else if (
        itemIdx === -1 &&
        (h.includes("barang") ||
          h.includes("item") ||
          h.includes("produk") ||
          h === "sp" ||
          h.includes("starterpack"))
      ) {
        itemIdx = c;
      } else if (
        qtyIdx === -1 &&
        (h === "qty" || h === "jumlah" || h === "kuantitas" || h === "quantity" || h.includes("qty"))
      ) {
        qtyIdx = c;
      } else if (
        ptIdx === -1 &&
        (h === "point" || h === "poin" || h === "points" || h.includes("point") || h.includes("poin"))
      ) {
        ptIdx = c;
      }
    }

    // A valid header must at least recognize No Penjualan and (Nama Barang or Point)
    if (noIdx !== -1 && (itemIdx !== -1 || ptIdx !== -1)) {
      headerRowIndex = r;
      colNoPenjualan = noIdx;
      colNamaBarang = itemIdx;
      colQty = qtyIdx;
      colPoint = ptIdx;
      break;
    }
  }

  // If no header found by label, fall back to assumed default column order:
  // Col 0: No Penjualan, Col 1: Nama Barang, Col 2: Qty, Col 3: Point
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colNoPenjualan = 0;
    colNamaBarang = 1;
    colQty = 2;
    colPoint = 3;
  }

  const rows: ParsedSpPointRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] as unknown[];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawNo = colNoPenjualan >= 0 ? String(row[colNoPenjualan] ?? "").trim() : "";
    const rawItem = colNamaBarang >= 0 ? String(row[colNamaBarang] ?? "").trim() : "";
    const rawQty = colQty >= 0 ? row[colQty] : 1;
    const rawPoint = colPoint >= 0 ? row[colPoint] : 0;

    // Skip empty rows
    if (!rawNo && !rawItem) continue;

    // Skip footer / total rows
    const upperNo = rawNo.toUpperCase();
    if (upperNo === "TOTAL" || upperNo === "GRAND TOTAL" || upperNo === "JUMLAH") continue;

    if (!rawNo) {
      errors.push({ rowNumber: r + 1, message: "Nomor penjualan kosong." });
      continue;
    }

    let qty = 1;
    if (rawQty != null && rawQty !== "") {
      const qNum = Number(String(rawQty).replace(/,/g, ".").trim());
      if (!Number.isNaN(qNum) && qNum > 0) qty = Math.round(qNum);
    }

    let points = 0;
    if (rawPoint != null && rawPoint !== "") {
      const pNum = Number(String(rawPoint).replace(/,/g, ".").trim());
      if (!Number.isNaN(pNum)) points = Math.round(pNum);
    }

    rows.push({
      rowNumber: r + 1,
      noPenjualan: rawNo,
      namaBarang: rawItem || "SP (Starterpack)",
      qty,
      points,
    });
  }

  return { rows, errors };
}
