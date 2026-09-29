import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatRupiah } from "./format";

// Node's Intl inserts a non-breaking space (U+00A0) between "Rp" and the
// amount; normalize it to a plain space so the test doesn't depend on the
// exact whitespace character an ICU version happens to pick.
function normalizeSpaces(s: string) {
  return s.replace(/\s/g, " ");
}

describe("formatRupiah", () => {
  it("formats as Indonesian Rupiah with no decimals", () => {
    expect(normalizeSpaces(formatRupiah(1500000))).toBe("Rp 1.500.000");
  });

  it("handles zero", () => {
    expect(normalizeSpaces(formatRupiah(0))).toBe("Rp 0");
  });

  it("handles negative values (laba/rugi can be negative)", () => {
    expect(normalizeSpaces(formatRupiah(-25000))).toBe("-Rp 25.000");
  });
});

describe("formatNumber", () => {
  it("formats with Indonesian thousands separators", () => {
    expect(formatNumber(2384)).toBe("2.384");
  });

  it("formats with specified decimal digits", () => {
    expect(formatNumber(2384.5678, 0)).toBe("2.385");
    expect(formatNumber(2384.5678, 1)).toBe("2.384,6");
    expect(formatNumber(2384.5678, 2)).toBe("2.384,57");
    expect(formatNumber(2384.5678, 3)).toBe("2.384,568");
    expect(formatNumber(1500000, 2)).toBe("1.500.000,00");
  });
});

describe("formatDate", () => {
  it("formats a date string as DD MMM YYYY in UTC", () => {
    expect(formatDate("2026-09-01T00:00:00.000Z")).toBe("01 Sep 2026");
  });

  it("accepts a Date instance directly", () => {
    expect(formatDate(new Date("2026-01-15T00:00:00.000Z"))).toBe("15 Jan 2026");
  });
});
