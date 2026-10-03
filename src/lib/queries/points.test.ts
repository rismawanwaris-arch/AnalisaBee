import { describe, expect, it } from "vitest";
import { computeItemPoints, computeMonthPeriod, computeWeekPeriod, classifyItemCategory } from "./points";

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

  it("resolves points according to effective startDate (Option A: date-versioned rules)", () => {
    const itemBatok = [{ id: 10, name: "Batok UI ME PC08 USB Type C White", itemGroup: "ACC CAMPURAN NEW" }];
    const versionedRules = [
      { pattern: "Batok UI ME PC08 USB Type C", points: 50, startDate: "2020-01-01" },
      { pattern: "Batok UI ME PC08 USB Type C", points: 75, startDate: "2026-10-02" },
    ];

    // Transaction on 2026-10-01 (before update): should get 50 points
    const resultBefore = computeItemPoints(itemBatok, versionedRules, groupDefaults, [], "2026-10-01");
    expect(resultBefore.get(10)).toBe(50);

    // Transaction on 2026-10-02 (on update date): should get 75 points
    const resultOnDate = computeItemPoints(itemBatok, versionedRules, groupDefaults, [], "2026-10-02");
    expect(resultOnDate.get(10)).toBe(75);

    // Transaction on 2026-10-15 (after update date): should get 75 points
    const resultAfter = computeItemPoints(itemBatok, versionedRules, groupDefaults, [], "2026-10-15");
    expect(resultAfter.get(10)).toBe(75);
  });

  it("handles chained historical updates and picks the latest effective rule", () => {
    const itemTws = [{ id: 11, name: "TWS UFONE EB05 Black", itemGroup: "ACC CAMPURAN NEW" }];
    const chainRules = [
      { pattern: "TWS UFONE EB05", points: 30, startDate: "2026-01-01" },
      { pattern: "TWS UFONE EB05", points: 50, startDate: "2026-10-02" },
      { pattern: "TWS UFONE EB05", points: 65, startDate: "2026-11-01" },
    ];

    expect(computeItemPoints(itemTws, chainRules, [], [], "2026-09-30").get(11)).toBe(30);
    expect(computeItemPoints(itemTws, chainRules, [], [], "2026-10-02").get(11)).toBe(50);
    expect(computeItemPoints(itemTws, chainRules, [], [], "2026-10-25").get(11)).toBe(50);
    expect(computeItemPoints(itemTws, chainRules, [], [], "2026-11-01").get(11)).toBe(65);
    expect(computeItemPoints(itemTws, chainRules, [], [], "2026-12-10").get(11)).toBe(65);
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

describe("computeWeekPeriod", () => {
  it("returns Monday-Sunday for a date mid-week (Thursday)", () => {
    // 2026-01-01 is a Thursday.
    const { from, to } = computeWeekPeriod("2026-01-01");
    expect(from.toISOString()).toBe("2025-12-29T00:00:00.000Z"); // Monday
    expect(to.toISOString()).toBe("2026-01-04T00:00:00.000Z"); // Sunday
  });

  it("treats Sunday as the end of the same week, not the start of the next", () => {
    // 2026-01-04 is a Sunday, in the same Mon-Sun week as 2026-01-01.
    const { from, to } = computeWeekPeriod("2026-01-04");
    expect(from.toISOString()).toBe("2025-12-29T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("returns the week itself unchanged when given a Monday", () => {
    const { from, to } = computeWeekPeriod("2025-12-29");
    expect(from.toISOString()).toBe("2025-12-29T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});

describe("classifyItemCategory", () => {
  it("classifies TWS products", () => {
    expect(classifyItemCategory("TWS Robot Airbuds T70E (WHITE)")).toBe("TWS");
  });

  it("classifies Kabel Data products, including the UI ME FLEX variant", () => {
    expect(classifyItemCategory("Kabel Data UI ME DCP05-CC")).toBe("Kabel Data");
    expect(classifyItemCategory("Kabel UI ME FLEX DCG01-C")).toBe("Kabel Data");
  });

  it("classifies generic Charger and Batok products as Charger", () => {
    expect(classifyItemCategory("Batok UI ME PC08 USB Type C")).toBe("Charger");
    expect(classifyItemCategory("Charger Minimo CGP02-CC")).toBe("Charger");
  });

  it("classifies Car Charger under Car Holder/Charger, not the generic Charger bucket", () => {
    expect(classifyItemCategory("Car Charger Minimo MSF02")).toBe("Car Holder/Charger");
    expect(classifyItemCategory("Car Holder UFONE CH02")).toBe("Car Holder/Charger");
  });

  it("classifies Power Bank, Speaker, and Handsfree products", () => {
    expect(classifyItemCategory("Power Bank Robot RT102")).toBe("Power Bank");
    expect(classifyItemCategory("Speaker Ichiko SZ1214")).toBe("Speaker");
    expect(classifyItemCategory("HF Robot REC10E Type C")).toBe("Handsfree");
  });

  it("falls back to Lainnya for anything unmatched", () => {
    expect(classifyItemCategory("Nasi Goreng Kucing")).toBe("Lainnya");
  });
});
