import { useQuery } from "@tanstack/react-query";

interface OutletOption {
  id: number;
  name: string;
}

/** GET /api/outlets, cached via React Query — the server already sends
 *  `Cache-Control: private, max-age=30` on this endpoint too, so a page
 *  revisited within 30s gets an instant, network-free list either way. */
export function useOutlets() {
  return useQuery({
    queryKey: ["outlets"],
    queryFn: async (): Promise<OutletOption[]> => {
      const res = await fetch("/api/outlets");
      if (!res.ok) throw new Error("Gagal memuat daftar outlet.");
      return res.json();
    },
  });
}
