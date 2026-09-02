"use client";

import Link from "next/link";
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
      <Link href={`/outlets/${o.id}`} className="hover:underline font-medium">
        {o.name}
      </Link>
    ),
  },
  {
    key: "qty",
    label: "Qty",
    align: "right",
    accessor: (o) => o.qty,
    render: (o) => formatNumber(o.qty),
  },
  {
    key: "subtotal",
    label: "Omzet",
    align: "right",
    accessor: (o) => o.subtotal,
    render: (o) => formatRupiah(o.subtotal),
  },
  {
    key: "labaRugi",
    label: "Laba/Rugi",
    align: "right",
    accessor: (o) => o.labaRugi,
    render: (o) => formatRupiah(o.labaRugi),
  },
  {
    key: "transactionCount",
    label: "Transaksi",
    align: "right",
    accessor: (o) => o.transactionCount,
    render: (o) => formatNumber(o.transactionCount),
  },
];

export function OutletsTable({ outlets }: { outlets: OutletRow[] }) {
  return (
    <SortableTable
      rows={outlets}
      columns={columns}
      rowKey={(o) => o.id}
      defaultSortKey="subtotal"
      caption="Matrix Outlet"
    />
  );
}
