// ==========================================
// MASTER ITEM PER CABANG — source of truth for item code -> name/kategori
// per cabang, master-only. Sales import (routes/imports.ts) only matches
// against this list, never redefines it.
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { previewMasterItemImport, importMasterItems } from "../../lib/queries/items";
import { requireMaster, logActivity } from "../middleware";
import { upload } from "../uploads";

export const masterItemsRouter = Router();

function parseBranchBody(v: unknown): "BANDUNG" | "CIMAHI" | null {
  return v === "BANDUNG" || v === "CIMAHI" ? v : null;
}

masterItemsRouter.get("/api/settings/master-items/summary", requireMaster, async (_req, res) => {
  try {
    const [bandung, cimahi] = await Promise.all([
      prisma.item.aggregate({
        where: { branch: "BANDUNG" },
        _count: { _all: true },
      }),
      prisma.item.aggregate({
        where: { branch: "CIMAHI" },
        _count: { _all: true },
      }),
    ]);
    const [bandungUnofficial, cimahiUnofficial] = await Promise.all([
      prisma.item.count({ where: { branch: "BANDUNG", isFromSalesImport: true } }),
      prisma.item.count({ where: { branch: "CIMAHI", isFromSalesImport: true } }),
    ]);
    return res.json({
      BANDUNG: { total: bandung._count._all, unofficial: bandungUnofficial },
      CIMAHI: { total: cimahi._count._all, unofficial: cimahiUnofficial },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

masterItemsRouter.post(
  "/api/settings/master-items/preview",
  requireMaster,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
    const branch = parseBranchBody(req.body.branch);
    if (!branch) return res.status(400).json({ error: "Cabang wajib dipilih." });
    try {
      const preview = await previewMasterItemImport(req.file.buffer, branch);
      return res.json(preview);
    } catch (err: any) {
      return res.status(422).json({ error: err.message || "Gagal membaca file Excel." });
    }
  }
);

masterItemsRouter.post(
  "/api/settings/master-items/import",
  requireMaster,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
    const branch = parseBranchBody(req.body.branch);
    if (!branch) return res.status(400).json({ error: "Cabang wajib dipilih." });
    try {
      const summary = await importMasterItems(req.file.buffer, branch);
      await logActivity(
        req,
        "MASTER_ITEM_IMPORT",
        `[${branch}] ${req.file.originalname} — ${summary.createdCount} baru, ${summary.updatedCount} diperbarui`
      );
      return res.json(summary);
    } catch (err: any) {
      return res.status(422).json({ error: err.message || "Gagal mengimpor file." });
    }
  }
);
