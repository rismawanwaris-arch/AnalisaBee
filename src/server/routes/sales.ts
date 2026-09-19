// ==========================================
// SALES / TRANSACTIONS — the "Daftar Transaksi" list and its CSV export.
// ==========================================
import { Router } from "express";
import { getSalesList, getSalesForExport } from "../../lib/queries/sales";
import { parseSalesFilterParams } from "../../lib/parseSalesFilterParams";
import { csvField } from "../../lib/csvSafe";
import { requireFeature } from "../middleware";

export const salesRouter = Router();

salesRouter.get("/api/sales", requireFeature("transactions"), async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const filter = parseSalesFilterParams(params);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 200);
    const result = await getSalesList(filter, page, pageSize);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

salesRouter.get("/api/sales/export", requireFeature("transactions"), async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const filter = parseSalesFilterParams(params);
    const rows = await getSalesForExport(filter);

    const headers = [
      "No Transaksi",
      "Tanggal",
      "Jam",
      "Outlet",
      "Kode Item",
      "Nama Item",
      "Qty",
      "Satuan",
      "Harga Jual",
      "Subtotal",
      "Laba/Rugi",
      "Pegawai",
    ];

    const csvRows = [
      headers.join(","),
      ...rows.map((r) =>
        [
          csvField(r.noTransaksi),
          csvField(r.tanggal.slice(0, 10)),
          csvField(r.jamBuat),
          csvField(r.outletName),
          csvField(r.itemCode),
          csvField(r.itemName),
          r.qty,
          csvField(r.unit),
          r.hargaJual,
          r.subtotal,
          r.labaRugi,
          csvField(r.employeeName),
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="penjualan-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.send(csvRows.join("\n"));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
