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

  // Batch-fetch matching sales
  const sales = await prisma.sale.findMany({
    where: { noTransaksi: { in: uniqueNos } },
    select: {
      id: true,
      noTransaksi: true,
      employeeId: true,
      outletId: true,
      tanggal: true,
      item: { select: { name: true } },
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

    // If multiple lines in same receipt, try to match by item name
    const itemUpper = row.namaBarang.toUpperCase().trim();
    let pickedSale = matchingSales.find((s) => {
      const sItemUpper = (s.item?.name ?? "").toUpperCase().trim();
      return sItemUpper.includes(itemUpper) || itemUpper.includes(sItemUpper);
    });

    if (!pickedSale) {
      pickedSale = matchingSales[0];
    }

    validRecords.push({
      noPenjualan: row.noPenjualan.trim(),
      namaBarang: row.namaBarang.trim(),
      qty: row.qty,
      points: row.points,
      tanggal: pickedSale.tanggal,
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
