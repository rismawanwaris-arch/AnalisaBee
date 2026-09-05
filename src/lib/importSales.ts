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
  noCabangCount: number;
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

/**
 * Builds hashes for all rows, adding a `_N` suffix for rows that appear
 * more than once in the file (identical raw data). This handles the POS bug
 * where an item update creates two separate rows instead of one with qty 2.
 *
 * The suffix is positional within the file, so re-importing the same file
 * always produces the same hashes → still deduplicates correctly.
 * Overlapping period imports only ever see one occurrence per transaction,
 * so no double-counting occurs.
 */
function buildHashesWithOccurrence(rows: ParsedSaleRow[]): Map<ParsedSaleRow, string> {
  const baseCount = new Map<string, number>();
  const result = new Map<ParsedSaleRow, string>();
  for (const r of rows) {
    const base = buildRowHash(r);
    const n = baseCount.get(base) ?? 0;
    baseCount.set(base, n + 1);
    result.set(r, n === 0 ? base : `${base}_${n}`);
  }
  return result;
}

export async function importSalesFile(
  filename: string,
  buffer: Buffer,
  forceImportHashes: string[] = [],
  branch: "BANDUNG" | "CIMAHI" = "BANDUNG"
): Promise<ImportSummary> {
  const { rows, errors, totalRows } = parseExcelBuffer(buffer);

  // Build row hashes BEFORE inferring cabang so dedup key is stable across re-imports.
  // Uses occurrence-aware hashing so POS-bug duplicate lines each get a unique hash.
  const precomputedHashes = buildHashesWithOccurrence(rows);

  // Fill in missing Cabang values from employee history
  const noCabangCount = await inferCabangForRows(rows);

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
      branch,
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
        data: outletNames.map((name) => ({ name, branch })),
        skipDuplicates: true,
      });
      // Update branch for existing outlets that match this import's cabang names
      await prisma.outlet.updateMany({
        where: { name: { in: outletNames } },
        data: { branch },
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
      rowHash: precomputedHashes.get(r)!,
      outletId: outletIdByName.get(r.cabang)!,
      itemId: itemIdByCode.get(r.kodeItem)!,
      employeeId: employeeIdByName.get(r.pegawai)!,
      importId: batch.id,
    }));

    // Delete existing records for rows the user chose to force-import (overwrite).
    if (forceImportHashes.length > 0) {
      await prisma.sale.deleteMany({ where: { rowHash: { in: forceImportHashes } } });
    }

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
      noCabangCount,
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

const FALLBACK_OUTLET = "TIDAK DIKETAHUI";

/**
 * For rows where Cabang is empty in the source file, look up each pegawai's
 * most recent outlet from DB history. Falls back to FALLBACK_OUTLET if no
 * history exists.
 *
 * IMPORTANT: Call this AFTER building the row hash — the hash intentionally
 * uses the raw empty-string cabang so the same row produces the same dedup
 * key on every re-import.
 */
async function inferCabangForRows(rows: ParsedSaleRow[]): Promise<number> {
  const noCabang = rows.filter((r) => !r.cabang);
  if (noCabang.length === 0) return 0;

  const pegawaiNames = uniq(noCabang.map((r) => r.pegawai));
  const inferred = new Map<string, string>();

  if (pegawaiNames.length > 0) {
    const sales = await prisma.sale.findMany({
      where: { employee: { name: { in: pegawaiNames } } },
      select: { employee: { select: { name: true } }, outlet: { select: { name: true } } },
      orderBy: { tanggal: "desc" },
      distinct: ["employeeId"],
    });
    sales.forEach((s) => {
      if (!inferred.has(s.employee.name)) {
        inferred.set(s.employee.name, s.outlet.name);
      }
    });
  }

  for (const row of noCabang) {
    row.cabang = inferred.get(row.pegawai) ?? FALLBACK_OUTLET;
  }

  return noCabang.length;
}

const HASH_CHECK_BATCH = 5000;
const DUPLICATE_LIST_CAP = 5000;
const NEW_SAMPLE_SIZE = 20;

export interface OriginalRowSnapshot {
  rowNumber: number;
  noTransaksi: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  subtotal: number;
  pegawai: string;
}

export interface PreviewRow {
  rowNumber: number;
  status: "NEW" | "DUPLICATE_EXISTING" | "DUPLICATE_IN_FILE";
  rowHash?: string;
  noTransaksi: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  subtotal: number;
  pegawai: string;
  /** DUPLICATE_IN_FILE: baris pertama dalam file ini yang memiliki data sama */
  duplicateOfRow?: number;
  /** DUPLICATE_IN_FILE: full data baris pertama, untuk perbandingan manual */
  originalRow?: OriginalRowSnapshot;
  /** DUPLICATE_EXISTING: info import batch yang sebelumnya menyimpan data ini */
  existingImport?: { filename: string; uploadedAt: string };
}

export interface ImportPreview {
  totalRows: number;
  newCount: number;
  duplicateExistingCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  noCabangCount: number;
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

  // Hash BEFORE inferring cabang — keeps dedup key stable across re-imports.
  // Uses occurrence-aware hashing so POS-bug duplicate lines each get a unique hash.
  const occurrenceCount = new Map<string, number>();
  const withHash = rows.map((r, idx) => {
    const base = buildRowHash(r);
    const n = occurrenceCount.get(base) ?? 0;
    occurrenceCount.set(base, n + 1);
    return {
      row: r,
      rowNumber: idx + 2,
      hash: n === 0 ? base : `${base}_${n}`,
    };
  });

  // Fill in missing Cabang values from employee history (mutates row.cabang in withHash)
  const noCabangCount = await inferCabangForRows(rows);

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
  const seenInFile = new Map<string, OriginalRowSnapshot>(); // hash → first occurrence data
  const duplicates: PreviewRow[] = [];
  const newSample: PreviewRow[] = [];
  let newCount = 0;
  let duplicateExistingCount = 0;
  let duplicateInFileCount = 0;
  let duplicatesTruncated = false;

  const toPreviewRow = (
    w: (typeof withHash)[number],
    status: PreviewRow["status"],
    extra?: Pick<PreviewRow, "duplicateOfRow" | "originalRow" | "existingImport">
  ): PreviewRow => ({
    rowNumber: w.rowNumber,
    status,
    rowHash: status === "DUPLICATE_EXISTING" ? w.hash : undefined,
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
          toPreviewRow(w, "DUPLICATE_IN_FILE", {
            duplicateOfRow: seenInFile.get(w.hash)!.rowNumber,
            originalRow: seenInFile.get(w.hash),
          })
        );
      else duplicatesTruncated = true;
    } else {
      const snapshot: OriginalRowSnapshot = {
        rowNumber: w.rowNumber,
        noTransaksi: w.row.noTransaksi,
        tanggal: w.row.tanggal.toISOString(),
        cabang: w.row.cabang,
        namaItem: w.row.namaItem,
        qty: w.row.qty,
        subtotal: w.row.subtotal,
        pegawai: w.row.pegawai,
      };
      seenInFile.set(w.hash, snapshot);
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
    noCabangCount,
    errors: errors.slice(0, 50),
    duplicates,
    duplicatesTruncated,
    newSample,
  };
}
