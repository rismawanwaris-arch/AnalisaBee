import { useEffect, useState } from "react";

/** Computes the current business period boundaries based on a custom start day.
 *
 * Example: periodStartDay=25
 *   Today = Sep 10  → period is Aug 25 – Sep 24
 *   Today = Sep 26  → period is Sep 25 – Oct 24
 *
 * Returns ISO date strings (YYYY-MM-DD) for use in date inputs.
 */
export function computeCurrentPeriod(periodStartDay: number): { from: string; to: string } {
  const today = new Date();
  const todayDay = today.getDate();

  let fromYear = today.getFullYear();
  let fromMonth = today.getMonth() + 1; // 1-12

  if (todayDay < periodStartDay) {
    // Still inside the period that started last month
    fromMonth -= 1;
    if (fromMonth === 0) { fromMonth = 12; fromYear -= 1; }
  }

  // "to" = day before periodStartDay of the following month
  let toYear = fromYear;
  let toMonth = fromMonth + 1;
  if (toMonth > 12) { toMonth = 1; toYear += 1; }

  const from = new Date(Date.UTC(fromYear, fromMonth - 1, periodStartDay));
  const to = new Date(Date.UTC(toYear, toMonth - 1, periodStartDay - 1));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** Fetches the business periodStartDay from settings and exposes the current
 * period boundaries. Falls back to calendar month (day 1) if fetch fails. */
export function useMonthPeriod() {
  const [periodStartDay, setPeriodStartDay] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/points/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.periodStartDay) setPeriodStartDay(Number(data.periodStartDay));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return { periodStartDay, currentPeriod: computeCurrentPeriod(periodStartDay), loaded };
}
