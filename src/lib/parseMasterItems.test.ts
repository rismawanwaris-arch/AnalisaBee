import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseMasterItemBuffer } from "./parseMasterItems";

function makeBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Table List");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseMasterItemBuffer", () => {
  it("parses valid rows with Kode Item, Nama Item and Item Grup", () => {
    const buf = makeBuffer([
      { "Kode Item": "001506", "Nama Item": "CM SAMSUNG A73 5G", "Item Grup": "ACC CAMPURAN NEW" },
      { "Kode Item": "001505", "Nama Item": "CM SAMSUNG A72 4G/5G", "Item Grup": "ACC CAMPURAN NEW" },
    ]);
    const result = parseMasterItemBuffer(buf);
    expect(result.totalRows).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      code: "001506",
      name: "CM SAMSUNG A73 5G",
      itemGroup: "ACC CAMPURAN NEW",
    });
    expect(result.errors).toHaveLength(0);
  });

  it("treats a blank Item Grup as null instead of an empty string", () => {
    const buf = makeBuffer([{ "Kode Item": "001", "Nama Item": "Barang A", "Item Grup": "" }]);
    const result = parseMasterItemBuffer(buf);
    expect(result.rows[0].itemGroup).toBeNull();
  });

  it("works when Item Grup column is missing entirely", () => {
    const buf = makeBuffer([{ "Kode Item": "001", "Nama Item": "Barang A" }]);
    const result = parseMasterItemBuffer(buf);
    expect(result.rows[0].itemGroup).toBeNull();
  });

  it("flags rows with an empty Kode Item or Nama Item as errors, not silent drops", () => {
    const buf = makeBuffer([
      { "Kode Item": "", "Nama Item": "Barang A" },
      { "Kode Item": "002", "Nama Item": "" },
      { "Kode Item": "003", "Nama Item": "Barang C" },
    ]);
    const result = parseMasterItemBuffer(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.rowNumber)).toEqual([2, 3]);
  });

  it("keeps the first occurrence of a duplicate code and counts the rest", () => {
    const buf = makeBuffer([
      { "Kode Item": "001", "Nama Item": "Versi Pertama" },
      { "Kode Item": "001", "Nama Item": "Versi Kedua" },
    ]);
    const result = parseMasterItemBuffer(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Versi Pertama");
    expect(result.duplicateInFileCount).toBe(1);
  });

  it("throws a clear error when required headers are missing", () => {
    const buf = makeBuffer([{ "Kode Item": "001" }]); // no Nama Item column at all
    expect(() => parseMasterItemBuffer(buf)).toThrow(/Nama Item/);
  });

  it("throws when the sheet has no data rows", () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Kode Item", "Nama Item"]]);
    XLSX.utils.book_append_sheet(wb, sheet, "Table List");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(() => parseMasterItemBuffer(buf)).toThrow(/kosong/);
  });
});
