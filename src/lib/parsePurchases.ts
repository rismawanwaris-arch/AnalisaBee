import * as XLSX from "xlsx";

export interface ParsedPurchaseItemRow {
  itemSeq: number | null;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  discount: number;
  tax: number;
  price: number;
  subtotal: number;
}

export interface ParsedPurchaseInvoice {
  invoiceNumber: string;
  date: Date;
  refInvoice: string | null;
  outletName: string;
  vendor: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  otherFee: number;
  total: number;
  items: ParsedPurchaseItemRow[];
}

export interface ParsePurchaseResult {
  invoices: ParsedPurchaseInvoice[];
  totalRows: number;
  errors: { row: number; message: string }[];
  periodStart: Date | null;
  periodEnd: Date | null;
}

/**
 * Parses Excel date representation:
 * - Date object
 * - Excel serial number (e.g. 46266 or 46266.0 -> 2026-09-01)
 * - ISO string: "2026-09-01"
 * - Indonesian / slash format: "01/09/2026" or "01-09-2026"
 */
export function parseFlexibleDate(val: unknown): Date | null {
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const d = new Date(val);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  if (typeof val === "number" && Number.isFinite(val)) {
    // Excel serial date for years 1990-2100 is between 32874 and 73415
    if (val > 30000 && val < 90000) {
      // Excel epoch: 25569 days between 1900-01-01 and 1970-01-01
      const ms = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    }
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Excel serial string like "46266" or "46266.0"
    if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      return parseFlexibleDate(num);
    }

    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10) - 1;
      const d = parseInt(isoMatch[3], 10);
      return new Date(Date.UTC(y, m, d));
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      return new Date(Date.UTC(y, m, d));
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    }
  }

  return null;
}

function cleanNum(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    const s = val.replace(/,/g, "").trim();
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function cleanStr(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

/**
 * Normalizes keys in an object to lowercase alphanumeric for robust header matching
 */
function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    normalized[cleanKey] = v;
  }
  return normalized;
}

/**
 * Parses raw JSON rows (from sheet_to_json or CSV parsing) into structured PurchaseInvoices
 */
export function parseRawPurchaseRows(rawRows: Record<string, unknown>[]): ParsePurchaseResult {
  const invoicesMap = new Map<string, ParsedPurchaseInvoice>();
  const errors: { row: number; message: string }[] = [];
  let totalRows = 0;
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  rawRows.forEach((raw, idx) => {
    totalRows++;
    const rowNum = idx + 2;
    const r = normalizeRowKeys(raw);

    // Look for No Faktur
    const invoiceNumber = cleanStr(r["nofaktur"] || r["faktur"] || r["noinvoice"] || r["invoice"]);
    if (!invoiceNumber) {
      errors.push({ row: rowNum, message: "No Faktur tidak ditemukan." });
      return;
    }

    // Look for Tanggal
    const rawDate = r["tanggal"] || r["date"] || r["tgl"];
    const parsedDate = parseFlexibleDate(rawDate);
    if (!parsedDate) {
      errors.push({ row: rowNum, message: `Tanggal tidak valid: ${String(rawDate)}` });
      return;
    }

    if (!periodStart || parsedDate < periodStart) periodStart = parsedDate;
    if (!periodEnd || parsedDate > periodEnd) periodEnd = parsedDate;

    const vendor = cleanStr(r["vendor"] || r["suplier"] || r["supplier"], "Umum");
    const outletName = cleanStr(r["cabang"] || r["outlet"] || r["gudang"], "Pusat");
    const currency = cleanStr(r["matauang"] || r["currency"], "Rupiah");
    const refInvoice = cleanStr(r["fakturref"] || r["ref"] || null, null as any) || null;

    const subtotal = cleanNum(r["subtotal"]);
    const tax = cleanNum(r["pajak"] || r["tax"]);
    const discount = cleanNum(r["diskon"] || r["disc"]);
    const otherFee = cleanNum(r["lainlain"] || r["biayalain"] || r["otherfee"]);
    const total = cleanNum(r["total"]) || subtotal;

    // Item line
    const itemCode = cleanStr(r["kodeitem"] || r["kodebarang"] || r["itemcode"] || r["sku"]);
    const itemName = cleanStr(r["namaitem"] || r["namabarang"] || r["itemname"] || r["item"]);
    const qty = cleanNum(r["qty"] || r["kuantitas"] || r["jumlah"]);
    const unit = cleanStr(r["satuan"] || r["unit"], "PCS");
    const price = cleanNum(r["harga"] || r["hargasatuan"] || r["price"]);
    const subtotalItem = cleanNum(r["subtotalitem"] || r["totalitem"]) || qty * price;
    const itemSeq = cleanNum(r["nodetail"] || r["no"]);

    let inv = invoicesMap.get(invoiceNumber);
    if (!inv) {
      inv = {
        invoiceNumber,
        date: parsedDate,
        refInvoice,
        outletName,
        vendor,
        currency,
        subtotal,
        tax,
        discount,
        otherFee,
        total,
        items: [],
      };
      invoicesMap.set(invoiceNumber, inv);
    }

    if (itemName || itemCode || qty > 0) {
      inv.items.push({
        itemSeq: itemSeq > 0 ? itemSeq : inv.items.length + 1,
        itemCode: itemCode || "-",
        itemName: itemName || itemCode || "Item Tanpa Nama",
        qty,
        unit,
        discount: cleanNum(r["disc"] || r["diskonitem"]),
        tax: cleanNum(r["tax"] || r["pajakitem"]),
        price,
        subtotal: subtotalItem,
      });
    }
  });

  return {
    invoices: Array.from(invoicesMap.values()),
    totalRows,
    errors,
    periodStart,
    periodEnd,
  };
}

/**
 * Parses file Buffer (.xlsx, .xls, or .csv)
 */
export function parsePurchaseBuffer(buffer: Buffer): ParsePurchaseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("File tidak memiliki sheet apapun.");
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return parseRawPurchaseRows(rawRows);
}

/**
 * Parses raw text CSV / TSV string (e.g. pasted directly by the user)
 */
export function parsePurchaseText(text: string): ParsePurchaseResult {
  const workbook = XLSX.read(text, { type: "string", cellDates: true, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Teks data tidak valid.");
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return parseRawPurchaseRows(rawRows);
}
