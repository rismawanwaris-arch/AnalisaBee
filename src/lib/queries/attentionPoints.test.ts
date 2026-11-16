import { describe, expect, it } from "vitest";
import {
  AttentionValidationError,
  buildEmployeeSalesContextMap,
  parseDateOnly,
  type OutletMeta,
} from "./attentionPoints";

describe("parseDateOnly", () => {
  it("parses valid YYYY-MM-DD dates into UTC midnight", () => {
    const dt = parseDateOnly("2026-11-16");
    expect(dt.toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("rejects malformed date strings", () => {
    expect(() => parseDateOnly("16-11-2026")).toThrow(AttentionValidationError);
    expect(() => parseDateOnly("")).toThrow(AttentionValidationError);
  });

  it("rejects non-existent calendar dates like Feb 30", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow(AttentionValidationError);
  });
});

describe("buildEmployeeSalesContextMap", () => {
  const outletById = new Map<number, OutletMeta>([
    [1, { id: 1, name: "ALFA 1", branch: "BANDUNG" }],
    [2, { id: 2, name: "ALFA 2", branch: "BANDUNG" }],
    [3, { id: 3, name: "CIMAHI 1", branch: "CIMAHI" }],
  ]);

  it("picks the outlet with highest period sales count as home outlet and branch", () => {
    const map = buildEmployeeSalesContextMap(
      [
        { employeeId: 10, outletId: 1, count: 5 },
        { employeeId: 10, outletId: 2, count: 12 },
        { employeeId: 11, outletId: 3, count: 4 },
      ],
      [],
      outletById
    );

    const emp10 = map.get(10);
    expect(emp10?.homeOutletId).toBe(2);
    expect(emp10?.homeOutletName).toBe("ALFA 2");
    expect(emp10?.homeBranch).toBe("BANDUNG");
    expect(emp10?.branches.has("BANDUNG")).toBe(true);
    expect(emp10?.outletIds.has(1)).toBe(true);
    expect(emp10?.outletIds.has(2)).toBe(true);

    const emp11 = map.get(11);
    expect(emp11?.homeOutletId).toBe(3);
    expect(emp11?.homeBranch).toBe("CIMAHI");
  });

  it("uses fallback sales history only when an employee has zero sales in the current period", () => {
    const map = buildEmployeeSalesContextMap(
      [{ employeeId: 10, outletId: 1, count: 3 }],
      [
        { employeeId: 10, outletId: 3, count: 99 }, // should be ignored since emp 10 has period sales
        { employeeId: 12, outletId: 3, count: 7 },
        { employeeId: 12, outletId: 1, count: 2 },
      ],
      outletById
    );

    expect(map.get(10)?.homeOutletId).toBe(1);
    expect(map.get(10)?.homeBranch).toBe("BANDUNG");

    expect(map.get(12)?.homeOutletId).toBe(3);
    expect(map.get(12)?.homeOutletName).toBe("CIMAHI 1");
    expect(map.get(12)?.homeBranch).toBe("CIMAHI");
  });

  it("ignores hidden/unknown outlets absent from outletById", () => {
    const map = buildEmployeeSalesContextMap(
      [{ employeeId: 15, outletId: 999, count: 10 }],
      [],
      outletById
    );
    expect(map.has(15)).toBe(false);
  });
});
