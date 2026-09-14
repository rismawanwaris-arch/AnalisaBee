import { useQuery } from "@tanstack/react-query";

interface OutletOption {
  id: number;
  name: string;
}

/** GET /api/outlets, cached via React Query — the server already sends
 *  `Cache-Control: private, max-age=30` on this endpoint too, so a page
 *  revisited within 30s gets an instant, network-free list either way.
 *  Pass `branch` to scope the list to one cabang's outlets only. */
export function useOutlets(branch?: "BANDUNG" | "CIMAHI") {
  return useQuery({
    queryKey: ["outlets", branch ?? "all"],
    queryFn: async (): Promise<OutletOption[]> => {
      const params = branch ? `?branch=${branch}` : "";
      const res = await fetch(`/api/outlets${params}`);
      if (!res.ok) throw new Error("Gagal memuat daftar outlet.");
      return res.json();
    },
  });
}
