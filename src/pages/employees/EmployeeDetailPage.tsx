import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { TrendChart } from "@/components/TrendChart";
import { formatNumber, formatRupiah } from "@/lib/format";

interface EmployeeDetail {
  employee: { id: number; name: string };
  totals: {
    qty: number;
    subtotal: number;
    labaRugi: number;
    transactionCount: number;
  };
  trend: { tanggal: string; qty: number; subtotal: number }[];
  byOutlet: { outletId: number; outletName: string; qty: number; subtotal: number }[];
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/employees/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetail(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted font-medium py-12">
        <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
        <span>Memuat detail performa pegawai...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted">
        Pegawai tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/employees"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors mb-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Kembali ke Matrix Pegawai</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">{detail.employee.name}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard label="Total Qty Terjual" value={`${formatNumber(detail.totals.qty)} pcs`} />
        <StatCard label="Total Omzet" value={formatRupiah(detail.totals.subtotal)} />
        <StatCard label="Total Laba" value={formatRupiah(detail.totals.labaRugi)} />
        <StatCard label="Jumlah Transaksi" value={`${formatNumber(detail.totals.transactionCount)} struk`} />
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
          Tren Penjualan Harian
        </h2>
        <p className="text-[11px] text-muted mb-3">Fluktuasi omzet harian yang dilayani oleh pegawai ini</p>
        <TrendChart data={detail.trend} />
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2.5">
          Distribusi Penjualan per Outlet
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Outlet</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Qty Terjual</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {detail.byOutlet.map((o) => (
                <tr key={o.outletId} className="hover:bg-surface-hover/70 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <Link to={`/outlets/${o.outletId}`} className="hover:text-accent hover:underline">
                      {o.outletName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right text-foreground font-medium">{formatNumber(o.qty)}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-foreground font-semibold">{formatRupiah(o.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
