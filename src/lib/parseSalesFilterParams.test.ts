import { describe, expect, it } from "vitest";
import { parseSalesFilterParams } from "./parseSalesFilterParams";

function params(obj: Record<string, string>) {
  return new URLSearchParams(obj);
}

describe("parseSalesFilterParams", () => {
  it("returns all-undefined for an empty query", () => {
    const result = parseSalesFilterParams(params({}));
    expect(result.itemId).toBeUndefined();
    expect(result.from).toBeUndefined();
    expect(result.noTransaksi).toBeUndefined();
  });

  it("parses numeric id filters", () => {
    const result = parseSalesFilterParams(
      params({ itemId: "12", outletId: "3", employeeId: "85" })
    );
    expect(result.itemId).toBe(12);
    expect(result.outletId).toBe(3);
    expect(result.employeeId).toBe(85);
  });

  it("ignores a non-integer id (avoids silently matching the wrong row)", () => {
    const result = parseSalesFilterParams(params({ itemId: "12.5" }));
    expect(result.itemId).toBeUndefined();
  });

  it("parses valid date params and drops invalid ones", () => {
    const result = parseSalesFilterParams(params({ from: "2026-09-01", to: "not-a-date" }));
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeUndefined();
  });

  it("pads an HH:MM upper time bound to HH:MM:59 to include the whole minute", () => {
    const result = parseSalesFilterParams(params({ jamTo: "14:30" }));
    expect(result.jamTo).toBe("14:30:59");
  });

  it("leaves an already-seconds jamTo untouched", () => {
    const result = parseSalesFilterParams(params({ jamTo: "14:30:45" }));
    expect(result.jamTo).toBe("14:30:45");
  });

  it("trims text filters and treats blank as unset", () => {
    const result = parseSalesFilterParams(params({ noTransaksi: "  TRX001  " }));
    expect(result.noTransaksi).toBe("TRX001");

    const blank = parseSalesFilterParams(params({ noTransaksi: "   " }));
    expect(blank.noTransaksi).toBeUndefined();
  });

  it("parses min/max numeric range filters, including decimals", () => {
    const result = parseSalesFilterParams(
      params({ qtyMin: "1", qtyMax: "10", subtotalMin: "1000.5" })
    );
    expect(result.qtyMin).toBe(1);
    expect(result.qtyMax).toBe(10);
    expect(result.subtotalMin).toBe(1000.5);
  });
});
