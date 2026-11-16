import { describe, expect, it } from "vitest";
import { computeSevenDayFrom, mergeDashboardTrend } from "./dashboard";

describe("computeSevenDayFrom", () => {
  it("returns an inclusive 7-day start date (6 days before `to`)", () => {
    const to = new Date(Date.UTC(2026, 10, 16)); // 2026-11-16
    expect(computeSevenDayFrom(to).toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });

  it("rolls across month boundary cleanly", () => {
    const to = new Date(Date.UTC(2026, 10, 3)); // 2026-11-03
    expect(computeSevenDayFrom(to).toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });
});

describe("mergeDashboardTrend", () => {
  it("combines mapped POS laba, tartun, and server sales per date and sorts chronologically", () => {
    const pos = [
      { tanggal: "2026-11-12T00:00:00.000Z", qty: 10, subtotal: 500_000, labaRugi: 120_000 },
      { tanggal: "2026-11-10T00:00:00.000Z", qty: 5, subtotal: 200_000, labaRugi: 60_000 },
    ];
    const mappedLaba = new Map<string, number>([
      ["2026-11-10T00:00:00.000Z", 55_000],
      ["2026-11-12T00:00:00.000Z", 110_000],
    ]);
    const tartun = new Map<string, number>([
      ["2026-11-10T00:00:00.000Z", 30_000],
      ["2026-11-11T00:00:00.000Z", 25_000],
    ]);
    const server = new Map<string, number>([
      ["2026-11-11T00:00:00.000Z", 40_000],
      ["2026-11-12T00:00:00.000Z", 90_000],
    ]);

    const result = mergeDashboardTrend(pos, mappedLaba, tartun, server);

    expect(result).toEqual([
      {
        tanggal: "2026-11-10T00:00:00.000Z",
        qty: 5,
        subtotal: 200_000,
        labaRugi: 60_000,
        laporanHarianTotal: 85_000, // 55_000 + 30_000 + 0
      },
      {
        tanggal: "2026-11-11T00:00:00.000Z",
        qty: 0,
        subtotal: 0,
        labaRugi: 0,
        laporanHarianTotal: 65_000, // 0 + 25_000 + 40_000
      },
      {
        tanggal: "2026-11-12T00:00:00.000Z",
        qty: 10,
        subtotal: 500_000,
        labaRugi: 120_000,
        laporanHarianTotal: 200_000, // 110_000 + 0 + 90_000
      },
    ]);
  });
});
