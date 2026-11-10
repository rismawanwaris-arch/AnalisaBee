import { prisma } from "./prisma";
import { ensureDefaults } from "./ensureDefaults";
import { parseSpPointsBuffer, type ParsedSpPointRow } from "./parseSpPointsExcel";

export interface UnmatchedSpRow {
  rowNumber: number;
  noPenjualan: string;
  namaBarang: string;
  reason: string;
}

export interface ImportSpPointsSummary {
  batchId: number | null;
  filename: string;
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  totalPoints: number;
  totalQty: number;
  unmatchedRows: UnmatchedSpRow[];
  parseErrors: { rowNumber: number; message: string }[];
}

export function isSpItem(name: string, itemGroup?: string | null): boolean {
  const g = (itemGroup ?? "").toUpperCase().trim();
  const n = (name ?? "").toUpperCase().trim();

  if (g === "SP" || g === "VOUCHER") return true;
  if (n.startsWith("SP ") || n.startsWith("SP-") || n.startsWith("SP_") || n === "SP") return true;
  if (n.startsWith("V. ") || n.startsWith("V-") || n.startsWith("VOUCHER")) return true;
  if (n.includes("STARTERPACK") || n.includes("STARTER PACK") || n.includes("PERDANA")) return true;
  return false;
}

export async function importSpPointsFile(
  filename: string,
  buffer: Buffer | ArrayBuffer
): Promise<ImportSpPointsSummary> {
  await ensureDefaults();

  const { rows, errors: parseErrors } = parseSpPointsBuffer(buffer);
  if (rows.length === 0) {
    return {
      batchId: null,
      filename,
      totalRows: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      totalPoints: 0,
      totalQty: 0,
      unmatchedRows: [],
      parseErrors,
    };
  }

  // Collect unique transaction numbers
  const uniqueNos = [...new Set(rows.map((r) => r.noPenjualan.trim()))];

  // Batch-fetch matching sales with item group info
  const sales = await prisma.sale.findMany({
    where: { noTransaksi: { in: uniqueNos } },
    select: {
      id: true,
      noTransaksi: true,
      employeeId: true,
      outletId: true,
      tanggal: true,
      item: { select: { id: true, name: true, itemGroup: true } },
    },
  });

  // Group sales by noTransaksi
  const salesByNo = new Map<string, typeof sales>();
  for (const s of sales) {
    const list = salesByNo.get(s.noTransaksi) ?? [];
    list.push(s);
    salesByNo.set(s.noTransaksi, list);
  }

  const validRecords: {
    noPenjualan: string;
    namaBarang: string;
    qty: number;
    points: number;
    tanggal: Date;
    employeeId: number;
    outletId: number;
    saleId: number;
  }[] = [];

  const unmatchedRows: UnmatchedSpRow[] = [];
  let totalPoints = 0;
  let totalQty = 0;

  // Default point date to today UTC so imported activation points immediately appear
  // in the current active month/period on Papan Poin.
  const today = new Date();
  const defaultDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  // Track matched sale IDs in this batch so multiple non-SP items don't falsely claim an SP item
  const usedSaleIds = new Set<number>();

  for (const row of rows) {
    const matchingSales = salesByNo.get(row.noPenjualan.trim());
    if (!matchingSales || matchingSales.length === 0) {
      unmatchedRows.push({
        rowNumber: row.rowNumber,
        noPenjualan: row.noPenjualan,
        namaBarang: row.namaBarang,
        reason: "Nomor penjualan tidak ditemukan di data penjualan POS.",
      });
      continue;
    }

    const rowIsSp = isSpItem(row.namaBarang);
    const spCandidates = matchingSales.filter((s) => isSpItem(s.item?.name ?? "", s.item?.itemGroup));

    // If receipt has SP items, but this row in Excel is an accessory/non-SP item:
    // SKIP IT so that a multi-item receipt export doesn't give points to non-SP items!
    if (!rowIsSp && spCandidates.length > 0) {
      unmatchedRows.push({
        rowNumber: row.rowNumber,
        noPenjualan: row.noPenjualan,
        namaBarang: row.namaBarang,
        reason: "Bukan item SP / Starterpack (item non-SP dalam struk diabaikan).",
      });
      continue;
    }

    // If neither the row nor any item in the receipt is an SP item:
    if (!rowIsSp && spCandidates.length === 0) {
      unmatchedRows.push({
        rowNumber: row.rowNumber,
        noPenjualan: row.noPenjualan,
        namaBarang: row.namaBarang,
        reason: "Bukan item SP / Starterpack dan transaksi ini tidak memuat item SP.",
      });
      continue;
    }

    // Try matching specific SP item in the receipt
    const itemUpper = row.namaBarang.toUpperCase().trim();
    let pickedSale = spCandidates.find((s) => {
      if (usedSaleIds.has(s.id)) return false;
      const sItemUpper = (s.item?.name ?? "").toUpperCase().trim();
      return sItemUpper.includes(itemUpper) || itemUpper.includes(sItemUpper);
    });

    if (!pickedSale) {
      pickedSale = spCandidates.find((s) => !usedSaleIds.has(s.id));
    }

    if (!pickedSale) {
      pickedSale = spCandidates[0] ?? matchingSales[0];
    }

    if (pickedSale) {
      usedSaleIds.add(pickedSale.id);
    }

    // Determine point date: prefer explicit row date if given, otherwise today's date
    const pointDate = row.tanggal ?? defaultDate;

    validRecords.push({
      noPenjualan: row.noPenjualan.trim(),
      namaBarang: pickedSale?.item?.name ?? row.namaBarang.trim(),
      qty: row.qty,
      points: row.points,
      tanggal: pointDate,
      employeeId: pickedSale.employeeId,
      outletId: pickedSale.outletId,
      saleId: pickedSale.id,
    });

    totalPoints += row.points;
    totalQty += row.qty;
  }

  let batchId: number | null = null;
  if (validRecords.length > 0) {
    const batch = await prisma.spPointBatch.create({
      data: {
        filename,
        rowCount: validRecords.length,
        totalPoints,
      },
    });
    batchId = batch.id;

    await prisma.spActivationPoint.createMany({
      data: validRecords.map((r) => ({
        ...r,
        batchId: batch.id,
      })),
    });
  }

  return {
    batchId,
    filename,
    totalRows: rows.length,
    matchedCount: validRecords.length,
    unmatchedCount: unmatchedRows.length,
    totalPoints,
    totalQty,
    unmatchedRows,
    parseErrors,
  };
}

export async function listSpPointBatches() {
  await ensureDefaults();
  return prisma.spPointBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 30,
  });
}

export async function deleteSpPointBatch(batchId: number) {
  await ensureDefaults();
  await prisma.spPointBatch.delete({
    where: { id: batchId },
  });
}
