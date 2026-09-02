import { getOutletList } from "@/lib/queries/outlets";
import { OutletsTable } from "./OutletsTable";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  const outlets = await getOutletList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Outlet</h1>
        <p className="text-sm text-muted mt-1">
          Performa penjualan per outlet — klik judul kolom untuk urutkan (mis. Omzet dari
          termahal, atau Outlet A-Z).
        </p>
      </div>

      <OutletsTable outlets={outlets} />
    </div>
  );
}
