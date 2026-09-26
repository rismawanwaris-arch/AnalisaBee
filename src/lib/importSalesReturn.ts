import { prisma } from "@/lib/prisma";
import { parseSalesReturnBuffer } from "@/lib/parseSalesReturn";
import { rowHash } from "@/lib/hash";
import type { ParsedReturRow, ReturRowError } from "@/lib/parseSalesReturn";

const BATCH_SIZE = 2000;

// Same fallback employee used by the regular sales import (parseExcel.ts)
// for a blank "Pegawai" column — reused here so an unmatched retur row lands
// on the exact same Employee record instead of splitting fallback data
// across two differently-cased names.
const FALLBACK_EMPLOYEE = "Tidak diketahui";

export interface ReturImportSummary {
  importId: number;
  filename: string;
  totalRows: number;
  parsedRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorRowCount: number;
  /** Rows matched to their original Sale via No.Penjualan + Kode Item — poin & outlet/pegawai diwarisi langsung. */
  matchedCount: number;
  /** Rows with no matching original Sale — jatuh ke outlet dari kolom Cabang + pegawai "Tidak diketahui". */
  unmatchedCount: number;
  errors: ReturRowError[];
  periodStart: Date | null;
  periodEnd: Date | null;
}

/** Single source of truth for the dedup key — preview and the real import
 * must hash a row identically, or the preview would lie about what gets skipped. */
export function buildReturRowHash(r: ParsedReturRow): string {
  return rowHash([r.noRetur, r.tanggal.toISOString(), r.cabang, r.kodeItem, r.qty, r.noPenjualan]);
}

/** Same in-file duplicate handling as importSales.ts's buildHashesWithOccurrence. */
function buildHashesWithOccurrence(rows: ParsedReturRow[]): Map<ParsedReturRow, string> {
  const baseCount = new Map<string, number>();
  const result = new Map<ParsedReturRow, string>();
  for (const r of rows) {
    const base = buildReturRowHash(r);
    const n = baseCount.get(base) ?? 0;
    baseCount.set(base, n + 1);
    result.set(r, n === 0 ? base : `${base}_${n}`);
  }
  return result;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

interface MatchResult {
  saleId: number;
  employeeId: number;
  outletId: number;
  itemId: number;
  /** Prorated original cost (positive) for the returned qty — see plan §Algoritma pencocokan. */
  hpp: number;
}

/**
 * Exact match per row: Sale.noTransaksi == No.Penjualan AND item.code ==
 * Kode Item, within the selected branch, excluding a Sale already claimed by
 * another retur (returOfSaleId already pointing at it — from a previous
 * import or from an earlier row in this same file).
 */
async function resolveMatches(
  rows: ParsedReturRow[],
  branch: "BANDUNG" | "CIMAHI"
): Promise<Map<ParsedReturRow, MatchResult | null>> {
  const result = new Map<ParsedReturRow, MatchResult | null>();
  const noPenjualanValues = uniq(rows.map((r) => r.noPenjualan));

  if (noPenjualanValues.length === 0) {
    rows.forEach((r) => result.set(r, null));
    return result;
  }

  const kodeItemValues = uniq(rows.map((r) => r.kodeItem));
  const candidates = await prisma.sale.findMany({
    where: {
      noTransaksi: { in: noPenjualanValues },
      isRetur: false,
      item: { branch, code: { in: kodeItemValues } },
    },
    include: { item: { select: { code: true } } },
  });

  const alreadyClaimed = candidates.length
    ? await prisma.sale.findMany({
        where: { returOfSaleId: { in: candidates.map((c) => c.id) } },
        select: { returOfSaleId: true },
      })
    : [];
  const claimedIds = new Set(alreadyClaimed.map((a) => a.returOfSaleId!));

  const byKey = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    if (claimedIds.has(c.id)) continue;
    const key = `${c.noTransaksi}|${c.item.code}`;
    if (!byKey.has(key)) byKey.set(key, c);
  }

  // A sale can only be claimed by one retur row even within this same file
  // (guards against an ambiguous/duplicated pair in the export).
  const claimedThisFile = new Set<number>();
  for (const r of rows) {
    const key = `${r.noPenjualan}|${r.kodeItem}`;
    const sale = r.noPenjualan ? byKey.get(key) : undefined;
    if (sale && !claimedThisFile.has(sale.id)) {
      claimedThisFile.add(sale.id);
      const hppAsli = Number(sale.hpp);
      const qtyAsli = sale.qty;
      const hpp = qtyAsli !== 0 ? (hppAsli / qtyAsli) * r.qty : 0;
      result.set(r, { saleId: sale.id, employeeId: sale.employeeId, outletId: sale.outletId, itemId: sale.itemId, hpp });
    } else {
      result.set(r, null);
    }
  }

  return result;
}

export async function importSalesReturnFile(
  filename: string,
  buffer: Buffer,
  forceImportHashes: string[] = [],
  branch: "BANDUNG" | "CIMAHI" = "BANDUNG"
): Promise<ReturImportSummary> {
  const { rows, errors, totalRows } = parseSalesReturnBuffer(buffer);
  const precomputedHashes = buildHashesWithOccurrence(rows);

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
      isRetur: true,
    },
  });

  try {
    const matches = await resolveMatches(rows, branch);
    const unmatchedRows = rows.filter((r) => !matches.get(r));

    const outletNames = uniq(unmatchedRows.map((r) => r.cabang));
    if (outletNames.length) {
      // Same skipDuplicates-only-for-new-rows rule as importSales.ts — never
      // reassigns branch on an outlet that already exists.
      await prisma.outlet.createMany({
        data: outletNames.map((name) => ({ name, branch })),
        skipDuplicates: true,
      });
    }

    const needsFallbackEmployee = unmatchedRows.length > 0;
    if (needsFallbackEmployee) {
      await prisma.employee.createMany({ data: [{ name: FALLBACK_EMPLOYEE }], skipDuplicates: true });
    }

    const itemsByCode = new Map<string, { code: string; name: string }>();
    for (const r of unmatchedRows) {
      if (!itemsByCode.has(r.kodeItem)) itemsByCode.set(r.kodeItem, { code: r.kodeItem, name: r.namaItem });
    }
    if (itemsByCode.size) {
      const existingCodes = new Set(
        (
          await prisma.item.findMany({
            where: { branch, code: { in: [...itemsByCode.keys()] } },
            select: { code: true },
          })
        ).map((i) => i.code)
      );
      const newItems = [...itemsByCode.values()].filter((i) => !existingCodes.has(i.code));
      if (newItems.length) {
        await prisma.item.createMany({
          data: newItems.map((i) => ({ code: i.code, name: i.name, branch, isFromSalesImport: true })),
          skipDuplicates: true,
        });
      }
    }

    const [outlets, items, fallbackEmployee] = await Promise.all([
      prisma.outlet.findMany({ where: { name: { in: outletNames } } }),
      prisma.item.findMany({ where: { branch, code: { in: [...itemsByCode.keys()] } } }),
      needsFallbackEmployee ? prisma.employee.findUnique({ where: { name: FALLBACK_EMPLOYEE } }) : Promise.resolve(null),
    ]);
    const outletIdByName = new Map(outlets.map((o) => [o.name, o.id]));
    const itemIdByCode = new Map(items.map((i) => [i.code, i.id]));

    let matchedCount = 0;
    const saleData = rows.map((r) => {
      const match = matches.get(r) ?? null;
      if (match) matchedCount++;
      const hpp = match ? match.hpp : 0;
      const subtotal = r.harga * r.qty;
      const labaRugi = subtotal - hpp;

      return {
        noTransaksi: r.noRetur,
        tanggal: r.tanggal,
        jamBuat: "00:00:00",
        customer: r.customer,
        qty: -r.qty,
        unit: r.unit,
        hargaJual: r.harga,
        diskon: 0,
        subtotal: -subtotal,
        hpp: -hpp,
        labaRugi: -labaRugi,
        rowHash: precomputedHashes.get(r)!,
        isRetur: true,
        returOfSaleId: match?.saleId ?? null,
        outletId: match ? match.outletId : outletIdByName.get(r.cabang)!,
        itemId: match ? match.itemId : itemIdByCode.get(r.kodeItem)!,
        employeeId: match ? match.employeeId : fallbackEmployee!.id,
        importId: batch.id,
      };
    });

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
      data: { status: "DONE", insertedCount, duplicateCount, errorRowCount: errors.length },
    });

    return {
      importId: batch.id,
      filename,
      totalRows,
      parsedRows: rows.length,
      insertedCount,
      duplicateCount,
      errorRowCount: errors.length,
      matchedCount,
      unmatchedCount: rows.length - matchedCount,
      errors: errors.slice(0, 50),
      periodStart,
      periodEnd,
    };
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
    throw err;
  }
}

const HASH_CHECK_BATCH = 5000;
const DUPLICATE_LIST_CAP = 5000;
const NEW_SAMPLE_SIZE = 20;

export interface ReturOriginalRowSnapshot {
  rowNumber: number;
  noRetur: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  noPenjualan: string;
}

export interface ReturPreviewRow {
  rowNumber: number;
  status: "NEW" | "DUPLICATE_EXISTING" | "DUPLICATE_IN_FILE";
  rowHash?: string;
  noRetur: string;
  tanggal: string;
  cabang: string;
  namaItem: string;
  qty: number;
  noPenjualan: string;
  matched: boolean;
  employeeName: string;
  duplicateOfRow?: number;
  originalRow?: ReturOriginalRowSnapshot;
  existingImport?: { filename: string; uploadedAt: string };
}

export interface ReturImportPreview {
  totalRows: number;
  newCount: number;
  duplicateExistingCount: number;
  duplicateInFileCount: number;
  errorCount: number;
  matchedCount: number;
  unmatchedCount: number;
  errors: ReturRowError[];
  duplicates: ReturPreviewRow[];
  duplicatesTruncated: boolean;
  newSample: ReturPreviewRow[];
}

/**
 * Dry-run: parses the file, resolves matches against existing Sale rows, and
 * classifies every row as NEW / already-in-database / repeated-within-this-file,
 * without writing anything.
 */
export async function previewSalesReturnFile(
  buffer: Buffer,
  branch: "BANDUNG" | "CIMAHI" = "BANDUNG"
): Promise<ReturImportPreview> {
  const { rows, errors, totalRows } = parseSalesReturnBuffer(buffer);

  const occurrenceCount = new Map<string, number>();
  const withHash = rows.map((r, idx) => {
    const base = buildReturRowHash(r);
    const n = occurrenceCount.get(base) ?? 0;
    occurrenceCount.set(base, n + 1);
    return { row: r, rowNumber: idx + 2, hash: n === 0 ? base : `${base}_${n}` };
  });

  const matches = await resolveMatches(rows, branch);
  const employeeIds = uniq(
    [...matches.values()].filter((m): m is MatchResult => !!m).map((m) => String(m.employeeId))
  ).map(Number);
  const employees = employeeIds.length
    ? await prisma.employee.findMany({ where: { id: { in: employeeIds } } })
    : [];
  const employeeNameById = new Map(employees.map((e) => [e.id, e.name]));

  const matchedCount = [...matches.values()].filter(Boolean).length;

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

  const seenInFile = new Map<string, ReturOriginalRowSnapshot>();
  const duplicates: ReturPreviewRow[] = [];
  const newSample: ReturPreviewRow[] = [];
  let newCount = 0;
  let duplicateExistingCount = 0;
  let duplicateInFileCount = 0;
  let duplicatesTruncated = false;

  const toPreviewRow = (
    w: (typeof withHash)[number],
    status: ReturPreviewRow["status"],
    extra?: Pick<ReturPreviewRow, "duplicateOfRow" | "originalRow" | "existingImport">
  ): ReturPreviewRow => {
    const match = matches.get(w.row) ?? null;
    return {
      rowNumber: w.rowNumber,
      status,
      rowHash: status === "DUPLICATE_EXISTING" ? w.hash : undefined,
      noRetur: w.row.noRetur,
      tanggal: w.row.tanggal.toISOString(),
      cabang: w.row.cabang,
      namaItem: w.row.namaItem,
      qty: w.row.qty,
      noPenjualan: w.row.noPenjualan,
      matched: !!match,
      employeeName: match ? (employeeNameById.get(match.employeeId) ?? FALLBACK_EMPLOYEE) : FALLBACK_EMPLOYEE,
      ...extra,
    };
  };

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
      const snapshot: ReturOriginalRowSnapshot = {
        rowNumber: w.rowNumber,
        noRetur: w.row.noRetur,
        tanggal: w.row.tanggal.toISOString(),
        cabang: w.row.cabang,
        namaItem: w.row.namaItem,
        qty: w.row.qty,
        noPenjualan: w.row.noPenjualan,
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
    matchedCount,
    unmatchedCount: rows.length - matchedCount,
    errors: errors.slice(0, 50),
    duplicates,
    duplicatesTruncated,
    newSample,
  };
}
