import { describe, expect, it } from "vitest";
import { computeItemPoints, computeMonthPeriod } from "./points";

describe("computeItemPoints", () => {
  const items = [
    { id: 1, name: "TWS Robot Airbuds T70E (WHITE)", itemGroup: "ACC CAMPURAN NEW" },
    { id: 2, name: "Kabel Data UFONE TB01-CC C TO C 60W", itemGroup: "ACC CAMPURAN NEW" },
    { id: 3, name: "Nasi Goreng Kucing", itemGroup: "PETSHOP" },
    { id: 4, name: "Aksesoris Tanpa Aturan Apapun", itemGroup: "ACC CAMPURAN LAMA" },
  ];
  const rules = [
    { pattern: "TWS Robot Airbuds T70E", points: 20 },
    { pattern: "Kabel Data UFONE TB01-CC C TO C 60W", points: 10 },
  ];
  const groupDefaults = [
    { itemGroup: "ACC CAMPURAN NEW", points: 5 },
    { itemGroup: "ACC CAMPURAN LAMA", points: 5 },
  ];

  it("matches a pattern rule case-insensitively across color variants", () => {
    const result = computeItemPoints(items, rules, groupDefaults, []);
    expect(result.get(1)).toBe(20);
  });

  it("falls back to the item group default when no pattern matches", () => {
    const result = computeItemPoints(items, rules, groupDefaults, []);
    expect(result.get(4)).toBe(5);
  });

  it("gives 0 when neither a pattern nor a group default applies", () => {
    const result = computeItemPoints(items, rules, groupDefaults, []);
    expect(result.get(3)).toBe(0);
  });

  it("prefers the longest (most specific) matching pattern", () => {
    const overlapping = [
      { id: 5, name: "Charger Robot RT-A20C L C TO L", itemGroup: null },
    ];
    const overlappingRules = [
      { pattern: "Charger Robot RT-A20C", points: 10 },
      { pattern: "Charger Robot RT-A20C L C TO L", points: 15 },
    ];
    const result = computeItemPoints(overlapping, overlappingRules, [], []);
    expect(result.get(5)).toBe(15);
  });

  it("an exclusion always wins, even over an explicit pattern rule", () => {
    const result = computeItemPoints(items, rules, groupDefaults, [
      { pattern: "Kabel Data UFONE TB01-CC" },
    ]);
    expect(result.get(2)).toBe(0);
  });

  it("an exclusion also overrides a group default", () => {
    const result = computeItemPoints(items, rules, groupDefaults, [
      { pattern: "Aksesoris Tanpa Aturan" },
    ]);
    expect(result.get(4)).toBe(0);
  });
});

describe("computeMonthPeriod", () => {
  it("is the plain calendar month when periodStartDay is 1", () => {
    const { from, to } = computeMonthPeriod(2026, 9, 1);
    expect(from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("supports a custom cycle: the period is named after the month it starts in", () => {
    // Matches the settings page wording: "periode berjalan tanggal 29 sampai
    // 28 bulan berikutnya" — period labeled September (month=9) starts 29
    // Sep and runs into October, not the reverse.
    const { from, to } = computeMonthPeriod(2026, 9, 29);
    expect(from.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });

  it("rolls over the year boundary correctly for December", () => {
    const { from, to } = computeMonthPeriod(2026, 12, 29);
    expect(from.toISOString()).toBe("2026-12-29T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-28T00:00:00.000Z");
  });
});
