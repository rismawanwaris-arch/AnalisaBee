import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeCurrentPeriod, computePreviousPeriod } from "./useMonthPeriod";

describe("useMonthPeriod helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("computeCurrentPeriod", () => {
    it("returns calendar month when periodStartDay is 1", () => {
      vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0)); // 17 Oct 2026
      const { from, to } = computeCurrentPeriod(1);
      expect(from).toBe("2026-10-01");
      expect(to).toBe("2026-10-31");
    });

    it("returns business period when today is before periodStartDay", () => {
      vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0)); // 17 Oct 2026 (< 25)
      const { from, to } = computeCurrentPeriod(25);
      expect(from).toBe("2026-09-25");
      expect(to).toBe("2026-10-24");
    });

    it("returns business period when today is after or on periodStartDay", () => {
      vi.setSystemTime(new Date(2026, 9, 26, 12, 0, 0)); // 26 Oct 2026 (>= 25)
      const { from, to } = computeCurrentPeriod(25);
      expect(from).toBe("2026-10-25");
      expect(to).toBe("2026-11-24");
    });
  });

  describe("computePreviousPeriod", () => {
    it("returns previous calendar month when periodStartDay is 1", () => {
      vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0)); // Oct 2026
      const { from, to } = computePreviousPeriod(1);
      expect(from).toBe("2026-09-01");
      expect(to).toBe("2026-09-30");
    });

    it("handles year rollover for calendar month (Jan -> Dec)", () => {
      vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0)); // 15 Jan 2026
      const { from, to } = computePreviousPeriod(1);
      expect(from).toBe("2025-12-01");
      expect(to).toBe("2025-12-31");
    });

    it("returns previous business period when periodStartDay is custom", () => {
      vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0)); // 17 Oct 2026 (< 25)
      // Current period: 2026-09-25 to 2026-10-24
      // Previous period: 2026-08-25 to 2026-09-24
      const { from, to } = computePreviousPeriod(25);
      expect(from).toBe("2026-08-25");
      expect(to).toBe("2026-09-24");
    });

    it("handles year rollover for custom periodStartDay", () => {
      vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0)); // 10 Jan 2026 (< 25)
      // Current period: 2025-12-25 to 2026-01-24
      // Previous period: 2025-11-25 to 2025-12-24
      const { from, to } = computePreviousPeriod(25);
      expect(from).toBe("2025-11-25");
      expect(to).toBe("2025-12-24");
    });
  });
});
