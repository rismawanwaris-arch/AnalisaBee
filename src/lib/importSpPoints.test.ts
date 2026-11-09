import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { importSpPointsFile, listSpPointBatches, deleteSpPointBatch } from "./importSpPoints";
import { getLeaderboard, getEmployeePointBreakdown } from "./queries/points";

describe("SP Points Import & Leaderboard Integration", () => {
  let employeeId: number;
  let outletId: number;
  let itemId: number;
  let testSaleId: number;
  const testNoTransaksi = `TEST-JL-${Date.now()}`;
  const testDate = new Date("2026-11-05T00:00:00.000Z");

  afterAll(async () => {
    try {
      await prisma.sale.deleteMany({ where: { noTransaksi: { startsWith: "TEST-JL-" } } });
      await prisma.item.deleteMany({ where: { code: "TEST_SP_01" } });
      await prisma.outlet.deleteMany({ where: { name: "TEST OUTLET SP" } });
      await prisma.employee.deleteMany({ where: { name: "TEST EMP SP" } });
    } catch {
      // ignore
    }
  });

  beforeEach(async () => {
    // Ensure clean employee & outlet
    const emp = await prisma.employee.upsert({
      where: { name: "TEST EMP SP" },
      update: {},
      create: { name: "TEST EMP SP" },
    });
    employeeId = emp.id;

    const out = await prisma.outlet.upsert({
      where: { name: "TEST OUTLET SP" },
      update: {},
      create: { name: "TEST OUTLET SP", branch: "BANDUNG" },
    });
    outletId = out.id;

    const item = await prisma.item.upsert({
      where: { code_branch: { code: "TEST_SP_01", branch: "BANDUNG" } },
      update: {},
      create: { code: "TEST_SP_01", name: "SP AXIS 3 GB TEST", branch: "BANDUNG" },
    });
    itemId = item.id;

    // Create import batch for sale
    const batch = await prisma.importBatch.create({
      data: { filename: "test_sale.xlsx", rowCount: 1 },
    });

    const sale = await prisma.sale.create({
      data: {
        noTransaksi: testNoTransaksi,
        tanggal: testDate,
        jamBuat: "10:00:00",
        customer: "UMUM",
        qty: 1,
        unit: "PCS",
        hargaJual: 15000,
        diskon: 0,
        subtotal: 15000,
        hpp: 10000,
        labaRugi: 5000,
        rowHash: `hash-${testNoTransaksi}`,
        outletId,
        itemId,
        employeeId,
        importId: batch.id,
      },
    });
    testSaleId = sale.id;
  });

  it("successfully matches No Penjualan, awards points, and reflects in SP Leaderboard", async () => {
    const wsData = [
      ["No Penjualan", "Nama Barang", "Qty", "Point"],
      [testNoTransaksi, "SP AXIS 3 GB TEST", 1, 10],
      ["NON_EXISTENT_JL_9999", "SP UNKNOWN", 1, 20],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const summary = await importSpPointsFile("test_sp_points.xlsx", buf);
    expect(summary.totalRows).toBe(2);
    expect(summary.matchedCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.totalPoints).toBe(10);
    expect(summary.unmatchedRows[0].noPenjualan).toBe("NON_EXISTENT_JL_9999");

    expect(summary.batchId).not.toBeNull();

    // Check leaderboard for SP_VOUCHER category
    const from = new Date("2026-11-01T00:00:00.000Z");
    const to = new Date("2026-11-30T23:59:59.000Z");
    const leaderboard = await getLeaderboard(from, to, "BANDUNG", "SP_VOUCHER");

    const empRow = leaderboard.rows.find((r) => r.employeeId === employeeId);
    expect(empRow).toBeDefined();
    expect(empRow!.totalPoints).toBeGreaterThanOrEqual(10);

    // Check employee breakdown
    const breakdown = await getEmployeePointBreakdown(employeeId, from, to, undefined, "BANDUNG", "SP_VOUCHER");
    const spItem = breakdown.find((b) => b.itemName.includes("SP AXIS 3 GB TEST"));
    expect(spItem).toBeDefined();
    expect(spItem!.totalPoints).toBe(10);
    expect(spItem!.itemName).toContain("(di aktivasi");

    // Clean up batch
    if (summary.batchId) {
      await deleteSpPointBatch(summary.batchId);
    }
  });
});
