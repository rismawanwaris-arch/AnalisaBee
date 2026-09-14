import { useQuery } from "@tanstack/react-query";

interface PointsSettings {
  periodStartDay: number;
  pointTargetDaily: number;
  pointTargetWeekly: number;
  pointTargetMonthly: number;
  pointRupiahRate: number;
}

/** GET /api/points/settings, cached via React Query (30s staleTime, see
 *  App.tsx) — the server itself also sends `Cache-Control: private,
 *  max-age=30` on this endpoint, so the two layer nicely: this hook avoids a
 *  duplicate fetch when several components on the same page ask for it, and
 *  the HTTP cache backs up a fresh page load.
 *
 *  The settings themselves (cut-off day, rate, targets) are shared across
 *  both cabang — `branch` is only forwarded so a Cimahi-only custom role
 *  (holding points_cimahi, not points) isn't blocked from reading it. */
export function usePointsSettings(branch?: "BANDUNG" | "CIMAHI") {
  return useQuery({
    queryKey: ["points-settings", branch ?? "default"],
    queryFn: async (): Promise<PointsSettings> => {
      const params = branch ? `?branch=${branch}` : "";
      const res = await fetch(`/api/points/settings${params}`);
      if (!res.ok) throw new Error("Gagal memuat pengaturan poin.");
      return res.json();
    },
  });
}
