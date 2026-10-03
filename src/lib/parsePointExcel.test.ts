import { describe, expect, it } from "vitest";
import { parseExcelPointRows } from "./parsePointExcel";

describe("parseExcelPointRows", () => {
  it("parses 3-column rows with headers (Nama Barang, Point Lama, Point Baru)", () => {
    const raw = [
      ["Nama Barang", "Point Lama", "Point Baru"],
      ["Batok UI ME PC08 USB Type C", 50, 75],
      ["TWS UFONE EB04", 50, 60],
      ["TWS UFONE EB05", 30, 50],
    ];

    const result = parseExcelPointRows(raw);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({ pattern: "Batok UI ME PC08 USB Type C", points: 75 });
    expect(result.items[1]).toEqual({ pattern: "TWS UFONE EB04", points: 60 });
    expect(result.items[2]).toEqual({ pattern: "TWS UFONE EB05", points: 50 });
    expect(result.errors).toHaveLength(0);
  });

  it("parses 2-column rows with headers (Item, Poin)", () => {
    const raw = [
      ["Item / SKU", "Poin"],
      ["Charger Robot RT-A20L", 20],
      ["Kabel Data ufone CB02-CL", 20],
    ];

    const result = parseExcelPointRows(raw);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ pattern: "Charger Robot RT-A20L", points: 20 });
    expect(result.items[1]).toEqual({ pattern: "Kabel Data ufone CB02-CL", points: 20 });
  });

  it("handles rows without headers", () => {
    const raw = [
      ["Batok UI ME PC08 USB Type C", 50, 75],
      ["TWS UFONE EB04", 50, 60],
    ];

    const result = parseExcelPointRows(raw);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ pattern: "Batok UI ME PC08 USB Type C", points: 75 });
    expect(result.items[1]).toEqual({ pattern: "TWS UFONE EB04", points: 60 });
  });

  it("ignores blank rows and flags invalid points", () => {
    const raw = [
      ["Nama Barang", "Point Baru"],
      ["Valid Item", 30],
      ["", ""],
      ["Invalid Point Item", "bukan_angka"],
    ];

    const result = parseExcelPointRows(raw);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({ pattern: "Valid Item", points: 30 });
    expect(result.ignoredCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(4);
  });
});
