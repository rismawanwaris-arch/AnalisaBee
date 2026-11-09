import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSpPointsBuffer } from "./parseSpPointsExcel";

describe("parseSpPointsBuffer", () => {
  it("parses valid SP point rows with standard headers", () => {
    const wsData = [
      ["No Penjualan", "Nama Barang", "Qty", "Point"],
      ["JL26110001", "SP AXIS 3 GB", 1, 10],
      ["JL26110002", "SP TELKOMSEL 5 GB", 2, 25],
      ["JL26110003", "SP INDOSAT 9 GB", "3", "15"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parseSpPointsBuffer(buf);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      noPenjualan: "JL26110001",
      namaBarang: "SP AXIS 3 GB",
      qty: 1,
      points: 10,
    });
    expect(result.rows[1]).toEqual({
      rowNumber: 3,
      noPenjualan: "JL26110002",
      namaBarang: "SP TELKOMSEL 5 GB",
      qty: 2,
      points: 25,
    });
    expect(result.rows[2]).toEqual({
      rowNumber: 4,
      noPenjualan: "JL26110003",
      namaBarang: "SP INDOSAT 9 GB",
      qty: 3,
      points: 15,
    });
  });

  it("handles case-insensitive and varying header names", () => {
    const wsData = [
      ["NO. TRANSAKSI", "PRODUK / ITEM", "JUMLAH", "POIN"],
      ["JL0099", "SP XL 10GB", 1, 5],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parseSpPointsBuffer(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].noPenjualan).toBe("JL0099");
    expect(result.rows[0].namaBarang).toBe("SP XL 10GB");
    expect(result.rows[0].points).toBe(5);
  });

  it("skips total / grand total footer rows", () => {
    const wsData = [
      ["No Penjualan", "Nama Barang", "Qty", "Point"],
      ["JL001", "SP AXIS", 1, 10],
      ["TOTAL", "", 1, 10],
      ["GRAND TOTAL", "", 1, 10],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parseSpPointsBuffer(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].noPenjualan).toBe("JL001");
  });
});
