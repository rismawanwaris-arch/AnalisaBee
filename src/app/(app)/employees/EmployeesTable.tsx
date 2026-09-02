"use client";

import Link from "next/link";
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
      <Link href={`/employees/${e.id}`} className="hover:underline font-medium">
        {e.name}
      </Link>
    ),
  },
  {
    key: "qty",
    label: "Qty",
    align: "right",
    accessor: (e) => e.qty,
    render: (e) => formatNumber(e.qty),
  },
  {
    key: "subtotal",
    label: "Omzet",
    align: "right",
    accessor: (e) => e.subtotal,
    render: (e) => formatRupiah(e.subtotal),
  },
  {
    key: "labaRugi",
    label: "Laba/Rugi",
    align: "right",
    accessor: (e) => e.labaRugi,
    render: (e) => formatRupiah(e.labaRugi),
  },
  {
    key: "transactionCount",
    label: "Transaksi",
    align: "right",
    accessor: (e) => e.transactionCount,
    render: (e) => formatNumber(e.transactionCount),
  },
];

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  return (
    <SortableTable
      rows={employees}
      columns={columns}
      rowKey={(e) => e.id}
      defaultSortKey="subtotal"
      caption="Performa Pegawai"
    />
  );
}
