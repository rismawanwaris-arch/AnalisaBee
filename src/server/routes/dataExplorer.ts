// ==========================================
// DATA EXPLORER (Analisa Data) — gabungan Penjualan / Tarik Tunai / Komisi Server
// ==========================================
import { Router, type Request } from "express";
import {
  getUnifiedTransactions,
  deleteUnifiedTransaction,
  bulkDeleteUnifiedTransactions,
  sourceLabel,
  type TransactionSource,
} from "../../lib/queries/dataExplorer";
import { csvField } from "../../lib/csvSafe";
import { requireFeature, requireMaster, sendError, parseDateParam, logActivity } from "../middleware";

export const dataExplorerRouter = Router();

function parseDataExplorerFilters(req: Request) {
  return {
    from: parseDateParam(req.query.from),
    to: parseDateParam(req.query.to),
  };
}

dataExplorerRouter.get("/api/data-explorer", requireFeature("data_explorer"), async (req, res) => {
  try {
    const rows = await getUnifiedTransactions(parseDataExplorerFilters(req));
    return res.json(rows);
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat data.");
  }
});

dataExplorerRouter.get("/api/data-explorer/export", requireFeature("data_explorer"), async (req, res) => {
  try {
    const rows = await getUnifiedTransactions(parseDataExplorerFilters(req));
    const headers = ["Tanggal", "Jam", "Outlet", "Jenis Transaksi", "Jumlah", "Keterangan"];
    const csvRows = [
      headers.join(","),
      ...rows.map((r) =>
        [
          csvField(r.tanggal),
          csvField(r.jam ?? ""),
          csvField(r.outletName),
          csvField(sourceLabel(r.source)),
          r.jumlah,
          csvField(r.keterangan),
        ].join(","),
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="analisa-data-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(csvRows.join("\n"));
  } catch (err) {
    return sendError(res, 500, err, "Gagal membuat ekspor.");
  }
});

dataExplorerRouter.delete("/api/data-explorer/:source/:id", requireMaster, async (req, res) => {
  const source = String(req.params.source).toUpperCase();
  const id = Number(req.params.id);
  if (source !== "SALE" && source !== "TARTUN" && source !== "SERVER") {
    return res.status(400).json({ error: "Jenis data tidak valid." });
  }
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    await deleteUnifiedTransaction(source as TransactionSource, id);
    await logActivity(req, "HAPUS_DATA_EXPLORER", `${sourceLabel(source as TransactionSource)} #${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ error: "Data tidak ditemukan (sudah terhapus?)." });
    return sendError(res, 500, err, "Gagal menghapus data.");
  }
});

const MAX_BULK_DELETE = 5000;

dataExplorerRouter.post("/api/data-explorer/bulk-delete", requireMaster, async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Tidak ada data yang dipilih." });
  }
  if (items.length > MAX_BULK_DELETE) {
    return res.status(400).json({ error: `Maksimal ${MAX_BULK_DELETE} baris per penghapusan massal.` });
  }
  const valid: { source: TransactionSource; id: number }[] = [];
  for (const item of items) {
    const source = String(item?.source ?? "").toUpperCase();
    const id = Number(item?.id);
    if ((source !== "SALE" && source !== "TARTUN" && source !== "SERVER") || !Number.isInteger(id)) {
      return res.status(400).json({ error: "Ada item yang tidak valid dalam daftar yang dipilih." });
    }
    valid.push({ source: source as TransactionSource, id });
  }
  try {
    const result = await bulkDeleteUnifiedTransactions(valid);
    await logActivity(req, "HAPUS_MASSAL_DATA_EXPLORER", `${result.deleted} baris dihapus`);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return sendError(res, 500, err, "Gagal menghapus data secara massal.");
  }
});
