import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployeeDetail } from "@/lib/queries/employees";
import { StatCard } from "@/components/StatCard";
import { TrendChart } from "@/components/TrendChart";
import { formatNumber, formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId)) notFound();

  const detail = await getEmployeeDetail(employeeId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="text-sm text-muted hover:underline">
          ← Semua Pegawai
        </Link>
        <h1 className="text-xl font-semibold mt-1">{detail.employee.name}</h1>
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
        <h2 className="text-sm font-medium text-foreground mb-3">Penjualan per Outlet</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Outlet</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.byOutlet.map((o) => (
                <tr key={o.outletId}>
                  <td className="px-3 py-2">
                    <Link href={`/outlets/${o.outletId}`} className="hover:underline">
                      {o.outletName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(o.qty)}</td>
                  <td className="px-3 py-2 text-right">{formatRupiah(o.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
