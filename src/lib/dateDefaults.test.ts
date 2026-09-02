import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todayStr, yesterdayStr } from "./dateDefaults";

describe("dateDefaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today/yesterday as local YYYY-MM-DD", () => {
    vi.setSystemTime(new Date(2026, 8, 2, 10, 0, 0)); // 2 Sep 2026, local time
    expect(todayStr()).toBe("2026-09-02");
    expect(yesterdayStr()).toBe("2026-09-01");
  });

  it("rolls yesterday back across a month boundary", () => {
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0, 0)); // 1 Sep 2026
    expect(yesterdayStr()).toBe("2026-08-31");
  });

  it("rolls yesterday back across a year boundary", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0)); // 1 Jan 2026
    expect(yesterdayStr()).toBe("2025-12-31");
  });
});
