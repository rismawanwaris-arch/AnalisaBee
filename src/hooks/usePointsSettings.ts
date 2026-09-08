import { useQuery } from "@tanstack/react-query";

interface PointsSettings {
  periodStartDay: number;
  pointTargetDaily: number;
  pointTargetWeekly: number;
  pointTargetMonthly: number;
}

/** GET /api/points/settings, cached via React Query (30s staleTime, see
 *  App.tsx) — the server itself also sends `Cache-Control: private,
 *  max-age=30` on this endpoint, so the two layer nicely: this hook avoids a
 *  duplicate fetch when several components on the same page ask for it, and
 *  the HTTP cache backs up a fresh page load. */
export function usePointsSettings() {
  return useQuery({
    queryKey: ["points-settings"],
    queryFn: async (): Promise<PointsSettings> => {
      const res = await fetch("/api/points/settings");
      if (!res.ok) throw new Error("Gagal memuat pengaturan poin.");
      return res.json();
    },
  });
}
