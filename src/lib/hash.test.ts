import { describe, expect, it } from "vitest";
import { rowHash } from "./hash";

describe("rowHash", () => {
  it("is deterministic for the same fields", () => {
    const fields = ["TRX001", "2026-09-01", "10:00", "Outlet A", "Item X", 2, 50000];
    expect(rowHash(fields)).toBe(rowHash(fields));
  });

  it("produces a 64-char hex sha256 digest", () => {
    const hash = rowHash(["a", 1]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when any field differs (avoids false-positive dedup)", () => {
    const a = rowHash(["TRX001", "Item X", 2]);
    const b = rowHash(["TRX001", "Item X", 3]);
    expect(a).not.toBe(b);
  });

  it("differs based on field boundaries, not just concatenation", () => {
    // Guards against a join-based hash treating ["a", "bc"] the same as ["ab", "c"].
    const a = rowHash(["a", "bc"]);
    const b = rowHash(["ab", "c"]);
    expect(a).not.toBe(b);
  });
});
