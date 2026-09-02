import { getSalesForExport } from "@/lib/queries/sales";
import { formatDate } from "@/lib/format";
import { parseSalesFilterParams } from "@/lib/parseSalesFilterParams";

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseSalesFilterParams(searchParams);

  const rows = await getSalesForExport(filters);

  const headers = [
    "No Transaksi",
    "Tanggal",
    "Jam",
    "Outlet",
    "Kode Item",
    "Nama Item",
    "Qty",
    "Unit",
    "Harga Jual",
    "Subtotal",
    "Laba/Rugi",
    "Pegawai",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.noTransaksi,
        formatDate(r.tanggal),
        r.jamBuat,
        r.outletName,
        r.itemCode,
        r.itemName,
        r.qty,
        r.unit,
        r.hargaJual,
        r.subtotal,
        r.labaRugi,
        r.employeeName,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  const csv = "﻿" + lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="data-penjualan.csv"`,
    },
  });
}
