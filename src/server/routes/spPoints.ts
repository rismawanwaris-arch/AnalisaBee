import { Router } from "express";
import * as XLSX from "xlsx";
import { importSpPointsFile, listSpPointBatches, deleteSpPointBatch } from "../../lib/importSpPoints";
import { requireFeature, logActivity } from "../middleware";
import { upload } from "../uploads";

export const spPointsRouter = Router();

// Download template Excel for SP Point Import
spPointsRouter.get("/api/sp-points/template", requireFeature("import"), (_req, res) => {
  const wb = XLSX.utils.book_new();
  const wsData = [
    ["No Penjualan", "Nama Barang", "Qty", "Point"],
    ["JL24110001", "SP AXIS 3 GB", 1, 10],
    ["JL24110002", "SP TELKOMSEL 5 GB", 2, 25],
    ["JL24110003", "SP INDOSAT 9 GB", 1, 15],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, "Poin SP");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="template_poin_sp.xlsx"');
  return res.send(buf);
});

// Import SP Points Excel
spPointsRouter.post(
  "/api/sp-points/import",
  requireFeature("import"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File Excel wajib diunggah." });
    try {
      const summary = await importSpPointsFile(req.file.originalname, req.file.buffer);
      await logActivity(
        req,
        "IMPORT_SP_POINTS",
        `${req.file.originalname} — ${summary.matchedCount} baris cocok, ${summary.unmatchedCount} tidak cocok, total ${summary.totalPoints} poin`
      );
      return res.json(summary);
    } catch (err: any) {
      return res.status(422).json({ error: err.message || "Gagal mengimpor file Poin SP." });
    }
  }
);

// List import history batches
spPointsRouter.get("/api/sp-points/history", requireFeature("import"), async (_req, res) => {
  try {
    const batches = await listSpPointBatches();
    return res.json(batches);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete an import batch
spPointsRouter.delete("/api/sp-points/batch/:id", requireFeature("import"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID batch tidak valid." });
    await deleteSpPointBatch(id);
    await logActivity(req, "DELETE_SP_POINTS_BATCH", `id=${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
