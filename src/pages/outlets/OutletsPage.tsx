import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
import { SortableTable, type Column } from "@/components/SortableTable";

interface OutletRow {
  id: number;
  name: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
  transactionCount: number;
}

const columns: Column<OutletRow>[] = [
  {
    key: "name",
    label: "Outlet",
    accessor: (o) => o.name,
    render: (o) => (
      <Link to={`/outlets/${o.id}`} className="hover:text-accent hover:underline font-medium text-foreground">
        {o.name}
      </Link>
    ),
  },
  {
    key: "qty",
    label: "Qty Terjual",
    align: "right",
    accessor: (o) => o.qty,
    render: (o) => `${formatNumber(o.qty)} pcs`,
  },
  {
    key: "subtotal",
    label: "Total Omzet",
    align: "right",
    accessor: (o) => o.subtotal,
    render: (o) => formatRupiah(o.subtotal),
  },
  {
    key: "labaRugi",
    label: "Total Laba",
    align: "right",
    accessor: (o) => o.labaRugi,
    render: (o) => formatRupiah(o.labaRugi),
  },
  {
    key: "transactionCount",
    label: "Jumlah Transaksi",
    align: "right",
    accessor: (o) => o.transactionCount,
    render: (o) => `${formatNumber(o.transactionCount)} struk`,
  },
];

export function OutletsPage() {
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/outlets")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOutlets(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Performa Penjualan Outlet</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Matriks komparasi performa omzet, profit, dan volume penjualan per cabang outlet. Klik nama kolom untuk mengurutkan.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat data outlet...</span>
        </div>
      ) : (
        <SortableTable
          rows={outlets}
          columns={columns}
          rowKey={(o) => o.id}
          defaultSortKey="subtotal"
          caption="Matrix Outlet"
        />
      )}
    </div>
  );
}
