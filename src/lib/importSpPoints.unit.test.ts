import { describe, expect, it, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";

const mockTx = {
  $executeRaw: vi.fn().mockResolvedValue(1),
  sale: { findMany: vi.fn() },
  spActivationPoint: { findMany: vi.fn(), createMany: vi.fn() },
  spPointBatch: { create: vi.fn() },
};

vi.mock("./prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => fn(mockTx)),
  },
}));

vi.mock("./ensureDefaults", () => ({
  ensureDefaults: vi.fn().mockResolvedValue(undefined),
}));

import { importSpPointsFile } from "./importSpPoints";
import { prisma } from "./prisma";

function makeSpWorkbookBuffer(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["No Penjualan", "Nama Barang", "Qty", "Point"], ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Poin SP");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("importSpPointsFile concurrency lock & quota enforcement (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acquires pg_advisory_xact_lock inside transaction and prevents over-claiming remaining qty", async () => {
    mockTx.sale.findMany.mockResolvedValueOnce([
      {
        id: 501,
        noTransaksi: "JL-1001",
        employeeId: 12,
        outletId: 3,
        tanggal: new Date("2026-11-10T00:00:00.000Z"),
        qty: 2,
        item: { id: 77, name: "SP AXIS 3 GB", itemGroup: "SP" },
      },
    ]);
    mockTx.spActivationPoint.findMany.mockResolvedValueOnce([
      { saleId: 501, qty: 1 }, // 1 of 2 already claimed previously -> only 1 remaining
    ]);
    mockTx.spPointBatch.create.mockResolvedValueOnce({ id: 888 });
    mockTx.spActivationPoint.createMany.mockResolvedValueOnce({ count: 1 });

    const buf = makeSpWorkbookBuffer([
      ["JL-1001", "SP AXIS 3 GB", 1, 10], // consumes the remaining 1
      ["JL-1001", "SP AXIS 3 GB", 1, 10], // exceeds quota -> rejected
    ]);

    const summary = await importSpPointsFile("sp.xlsx", buf);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(summary.matchedCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.totalPoints).toBe(10);
    expect(summary.batchId).toBe(888);
    expect(summary.unmatchedRows[0].reason).toContain("sudah pernah di-klaim");
  });
});
