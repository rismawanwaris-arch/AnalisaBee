import Link from "next/link";
import { notFound } from "next/navigation";
import { getOutletDetail } from "@/lib/queries/outlets";
import { StatCard } from "@/components/StatCard";
import { TrendChart } from "@/components/TrendChart";
import { formatNumber, formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OutletDetailPage({
  params,
}: PageProps<"/outlets/[id]">) {
  const { id } = await params;
  const outletId = Number(id);
  if (!Number.isInteger(outletId)) notFound();

  const detail = await getOutletDetail(outletId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/outlets" className="text-sm text-muted hover:underline">
          ← Semua Outlet
        </Link>
        <h1 className="text-xl font-semibold mt-1">{detail.outlet.name}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Qty" value={formatNumber(detail.totals.qty)} />
        <StatCard label="Total Omzet" value={formatRupiah(detail.totals.subtotal)} />
        <StatCard label="Total Laba" value={formatRupiah(detail.totals.labaRugi)} />
        <StatCard label="Transaksi" value={formatNumber(detail.totals.transactionCount)} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-foreground mb-2">Tren Omzet Harian</h2>
        <TrendChart data={detail.trend} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-foreground mb-3">Top 20 Item Terjual</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Kode</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.topItems.map((it) => (
                <tr key={it.itemId}>
                  <td className="px-3 py-2">
                    <Link href={`/items?id=${it.itemId}`} className="hover:underline">
                      {it.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{it.code}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(it.qty)}</td>
                  <td className="px-3 py-2 text-right">{formatRupiah(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
