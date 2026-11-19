import { describe, expect, it } from "vitest";
import { escapeCsvCell, buildCsvContent } from "./csv";

describe("CSV export formula neutralization", () => {
  it("neutralizes strings starting with formula trigger characters", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(escapeCsvCell("+cmd|' /C calc'!A0")).toBe("\"'+cmd|' /C calc'!A0\"");
    expect(escapeCsvCell("-2+3")).toBe("\"'-2+3\"");
    expect(escapeCsvCell("@SUM(1,2)")).toBe("\"'@SUM(1,2)\"");
    expect(escapeCsvCell("\t=1+1")).toBe("\"'\t=1+1\"");
    expect(escapeCsvCell("\r=1+1")).toBe("\"'\r=1+1\"");
  });

  it("escapes embedded quotes and preserves newlines/commas safely", () => {
    expect(escapeCsvCell('Outlet "Alpha", Bandung\nCabang 1')).toBe('"Outlet ""Alpha"", Bandung\nCabang 1"');
  });

  it("keeps finite positive and negative numbers numeric without apostrophe prefix", () => {
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(125000)).toBe("125000");
    expect(escapeCsvCell(-5000)).toBe("-5000");
    expect(escapeCsvCell(Number.NaN)).toBe("");
  });

  it("builds UTF-8 BOM CSV output with escaped headers and rows", () => {
    const csv = buildCsvContent(["Nama", "Laba"], [["=evil()", -1000]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1)).toBe('"Nama","Laba"\n"\'=evil()",-1000');
  });
});
