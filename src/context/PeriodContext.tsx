import React, { createContext, useContext, useEffect, useState } from "react";
import { computeCurrentPeriod } from "../lib/useMonthPeriod";

interface PeriodContextType {
  periodStartDay: number;
  currentPeriod: { from: string; to: string };
  loaded: boolean;
}

const PeriodContext = createContext<PeriodContextType>({
  periodStartDay: 1,
  currentPeriod: computeCurrentPeriod(1),
  loaded: false,
});

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [periodStartDay, setPeriodStartDay] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/points/settings", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.periodStartDay) setPeriodStartDay(Number(data.periodStartDay));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    return () => ctrl.abort();
  }, []);

  return (
    <PeriodContext.Provider value={{ periodStartDay, currentPeriod: computeCurrentPeriod(periodStartDay), loaded }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  return useContext(PeriodContext);
}
