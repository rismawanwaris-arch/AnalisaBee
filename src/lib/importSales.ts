import { prisma } from "@/lib/prisma";
import { parseExcelBuffer } from "@/lib/parseExcel";
import { rowHash } from "@/lib/hash";
import type { ParsedSaleRow, RowError } from "@/lib/parseExcel";

const BATCH_SIZE = 2000;

export interface ImportSummary {
  importId: number;
  filename: string;
  totalRows: number;
  parsedRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorRowCount: number;
  errors: RowError[];
  periodStart: Date | null;
  periodEnd: Date | null;
}

/** Single source of truth for the dedup key — preview and the real import
 * must hash a row identically, or the preview would lie about what gets skipped. */
export function buildRowHash(r: ParsedSaleRow): string {
  return rowHash([
    r.noTransaksi,
    r.tanggal.toISOString(),
    r.jamBuat,
    r.cabang,
    r.customer,
    r.kodeItem,
    r.namaItem,
    r.itemGroup ?? "",
    r.qty,
    r.unit,
    r.hargaJual,
    r.diskon,
    r.subtotal,
    r.hpp,
    r.labaRugi,
    r.pegawai,
  ]);
}

export async function importSalesFile(filename: string, buffer: Buffer): Promise<ImportSummary> {
  const { rows, errors, totalRows } = parseExcelBuffer(buffer);

  const periodStart = rows.length
    ? new Date(Math.min(...rows.map((r) => r.tanggal.getTime())))
    : null;
  const periodEnd = rows.length
    ? new Date(Math.max(...rows.map((r) => r.tanggal.getTime())))
    : null;

  const batch = await prisma.importBatch.create({
    data: {
      filename,
      status: "PROCESSING",
      rowCount: totalRows,
      errorRowCount: errors.length,
      periodStart,
      periodEnd,
    },
  });

  try {
    const outletNames = uniq(rows.map((r) => r.cabang));
    const employeeNames = uniq(rows.map((r) => r.pegawai));
    const itemsByCode = new Map<string, { code: string; name: string; group: string | null }>();
    for (const r of rows) {
      if (!itemsByCode.has(r.kodeItem)) {
        itemsByCode.set(r.kodeItem, { code: r.kodeItem, name: r.namaItem, group: r.itemGroup });
      }
    }

    if (outletNames.length) {
      await prisma.outlet.createMany({
        data: outletNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }
    if (employeeNames.length) {
      await prisma.employee.createMany({
        data: employeeNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }
    if (itemsByCode.size) {
      await prisma.item.createMany({
        data: [...itemsByCode.values()].map((i) => ({
          code: i.code,
          name: i.name,
          itemGroup: i.group,
        })),
        skipDuplicates: true,
      });
    }

    const [outlets, employees, items] = await Promise.all([
      prisma.outlet.findMany({ where: { name: { in: outletNames } } }),
      prisma.employee.findMany({ where: { name: { in: employeeNames } } }),
      prisma.item.findMany({ where: { code: { in: [...itemsByCode.keys()] } } }),
    ]);

    const outletIdByName = new Map(outlets.map((o) => [o.name, o.id]));
    const employeeIdByName = new Map(employees.map((e) => [e.name, e.id]));
    const itemIdByCode = new Map(items.map((i) => [i.code, i.id]));

    const saleData = rows.map((r) => ({
      noTransaksi: r.noTransaksi,
      tanggal: r.tanggal,
      jamBuat: r.jamBuat,
      customer: r.customer,
      qty: r.qty,
      unit: r.unit,
      hargaJual: r.hargaJual,
      diskon: r.diskon,
      subtotal: r.subtotal,
      hpp: r.hpp,
      labaRugi: r.labaRugi,
      rowHash: buildRowHash(r),
      outletId: outletIdByName.get(r.cabang)!,
      itemId: itemIdByCode.get(r.kodeItem)!,
      employeeId: employeeIdByName.get(r.pegawai)!,
      importId: batch.id,
    }));

    let insertedCount = 0;
    for (let i = 0; i < saleData.length; i += BATCH_SIZE) {
      const chunk = saleData.slice(i, i + BATCH_SIZE);
      const result = await prisma.sale.createMany({ data: chunk, skipDuplicates: true });
      insertedCount += result.count;
    }

    const duplicateCount = saleData.length - insertedCount;

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "DONE",
        insertedCount,
        duplicateCount,
        errorRowCount: errors.length,
      },
    });

    return {
      importId: batch.id,
      filename,
      totalRows,
      parsedRows: rows.length,
      insertedCount,
      duplicateCount,
      errorRowCount: errors.length,
      errors: errors.slice(0, 50),
      periodStart,
      periodEnd,
    };
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
    throw err;
  }
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

const HASH_CHECK_BATCH = 5000;
const DUPLICATE_LIST_CAP = 5000;
const NEW_SAMPLE_SIZE = 20;

export interface PreviewRow {
  rowNumber: number;
  status: "NEW" | "DUPLICATE_EXISTING" | "DUPLICATE_IN_FILE";
  noTransaksi: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  subtotal: number;
  pegawai: string;
  /** DUPLICATE_IN_FILE: baris pertama dalam file ini yang memiliki data sama */
  duplicateOfRow?: number;
  /** DUPLICATE_EXISTING: info import batch yang sebelumnya menyimpan data ini */
  existingImport?: { filename: string; uploadedAt: string };
}

export interface ImportPreview {
  totalRows: number;
  newCount: number;
  duplicateExistingCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  errors: RowError[];
  /** Every row flagged as a duplicate (capped — see DUPLICATE_LIST_CAP), for manual review. */
  duplicates: PreviewRow[];
  duplicatesTruncated: boolean;
  /** A handful of "new" rows so you can spot-check those too, not just the duplicates. */
  newSample: PreviewRow[];
}

/**
 * Dry-run: parses the file and classifies every row as NEW / already-in-database /
 * repeated-within-this-file, without writing anything. Lets the user manually verify
 * the dedup call before committing via importSalesFile with the same buffer.
 */
export async function previewSalesFile(buffer: Buffer): Promise<ImportPreview> {
  const { rows, errors, totalRows } = parseExcelBuffer(buffer);

  const withHash = rows.map((r, idx) => ({
    row: r,
    rowNumber: idx + 2,
    hash: buildRowHash(r),
  }));

  // Phase 1: check which hashes already exist in the DB
  const existingHashes = new Map<string, { filename: string; uploadedAt: string }>();
  const allHashes = withHash.map((w) => w.hash);
  for (let i = 0; i < allHashes.length; i += HASH_CHECK_BATCH) {
    const chunk = allHashes.slice(i, i + HASH_CHECK_BATCH);
    const found = await prisma.sale.findMany({
      where: { rowHash: { in: chunk } },
      select: { rowHash: true, import: { select: { filename: true, uploadedAt: true } } },
    });
    found.forEach((f) =>
      existingHashes.set(f.rowHash, {
        filename: f.import.filename,
        uploadedAt: f.import.uploadedAt.toISOString(),
      })
    );
  }

  // Phase 2: classify rows — track first occurrence per hash for in-file dedup
  const seenInFile = new Map<string, number>(); // hash → first rowNumber
  const duplicates: PreviewRow[] = [];
  const newSample: PreviewRow[] = [];
  let newCount = 0;
  let duplicateExistingCount = 0;
  let duplicateInFileCount = 0;
  let duplicatesTruncated = false;

  const toPreviewRow = (
    w: (typeof withHash)[number],
    status: PreviewRow["status"],
    extra?: Pick<PreviewRow, "duplicateOfRow" | "existingImport">
  ): PreviewRow => ({
    rowNumber: w.rowNumber,
    status,
    noTransaksi: w.row.noTransaksi,
    tanggal: w.row.tanggal.toISOString(),
    cabang: w.row.cabang,
    namaItem: w.row.namaItem,
    qty: w.row.qty,
    subtotal: w.row.subtotal,
    pegawai: w.row.pegawai,
    ...extra,
  });

  for (const w of withHash) {
    const existingImport = existingHashes.get(w.hash);
    if (existingImport) {
      duplicateExistingCount++;
      if (duplicates.length < DUPLICATE_LIST_CAP)
        duplicates.push(toPreviewRow(w, "DUPLICATE_EXISTING", { existingImport }));
      else duplicatesTruncated = true;
    } else if (seenInFile.has(w.hash)) {
      duplicateInFileCount++;
      if (duplicates.length < DUPLICATE_LIST_CAP)
        duplicates.push(
          toPreviewRow(w, "DUPLICATE_IN_FILE", { duplicateOfRow: seenInFile.get(w.hash) })
        );
      else duplicatesTruncated = true;
    } else {
      seenInFile.set(w.hash, w.rowNumber);
      newCount++;
      if (newSample.length < NEW_SAMPLE_SIZE) newSample.push(toPreviewRow(w, "NEW"));
    }
  }

  return {
    totalRows,
    newCount,
    duplicateExistingCount,
    duplicateInFileCount,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
    duplicates,
    duplicatesTruncated,
    newSample,
  };
}
