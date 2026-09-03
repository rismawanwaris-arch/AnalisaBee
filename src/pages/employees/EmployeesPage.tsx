import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
import { SortableTable, type Column } from "@/components/SortableTable";

interface EmployeeRow {
  id: number;
  name: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
  transactionCount: number;
}

const columns: Column<EmployeeRow>[] = [
  {
    key: "name",
    label: "Pegawai",
    accessor: (e) => e.name,
    render: (e) => (
      <Link to={`/employees/${e.id}`} className="hover:text-accent hover:underline font-medium text-foreground">
        {e.name}
      </Link>
    ),
  },
  {
    key: "qty",
    label: "Qty Terjual",
    align: "right",
    accessor: (e) => e.qty,
    render: (e) => `${formatNumber(e.qty)} pcs`,
  },
  {
    key: "subtotal",
    label: "Total Omzet",
    align: "right",
    accessor: (e) => e.subtotal,
    render: (e) => formatRupiah(e.subtotal),
  },
  {
    key: "labaRugi",
    label: "Total Laba",
    align: "right",
    accessor: (e) => e.labaRugi,
    render: (e) => formatRupiah(e.labaRugi),
  },
  {
    key: "transactionCount",
    label: "Jumlah Transaksi",
    align: "right",
    accessor: (e) => e.transactionCount,
    render: (e) => `${formatNumber(e.transactionCount)} struk`,
  },
];

export function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEmployees(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Performa Pegawai &amp; Staff</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Matriks komparasi produktivitas sales, laba, dan jumlah transaksi yang dilayani oleh setiap pegawai.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat data pegawai...</span>
        </div>
      ) : (
        <SortableTable
          rows={employees}
          columns={columns}
          rowKey={(e) => e.id}
          defaultSortKey="subtotal"
          caption="Performa Pegawai"
        />
      )}
    </div>
  );
}
