// ==========================================
// IMPORTS & UPLOADS — sales Excel import, Tarik Tunai / Server daily metric
// import, import-batch history, and browsing/deleting already-imported daily
// Tartun/Server aggregates. Master Item catalog import lives in
// routes/masterItems.ts (a separate source-of-truth concern).
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { previewSalesFile, importSalesFile } from "../../lib/importSales";
import { previewSalesReturnFile, importSalesReturnFile } from "../../lib/importSalesReturn";
import { invalidateDefaults } from "../../lib/ensureDefaults";
import { parseTartunBuffer, parseServerBuffer, parseServerText } from "../../lib/parseTartunServer";
import { importDailyMetric } from "../../lib/importTartunServer";
import { requireFeature, logActivity } from "../middleware";
import { upload } from "../uploads";

export const importsRouter = Router();

importsRouter.post("/api/import/preview", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  try {
    const preview = await previewSalesFile(req.file.buffer);
    return res.json(preview);
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal membaca file Excel." });
  }
});

importsRouter.post("/api/import", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  try {
    let forceImportHashes: string[] = [];
    if (req.body.forceImportHashes) {
      const parsed = JSON.parse(req.body.forceImportHashes);
      if (!Array.isArray(parsed) || parsed.length > 500) {
        return res.status(400).json({ error: "forceImportHashes tidak valid." });
      }
      forceImportHashes = parsed.filter((h): h is string => typeof h === "string");
    }
    const branch = (req.body.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const summary = await importSalesFile(req.file.originalname, req.file.buffer, forceImportHashes, branch);
    invalidateDefaults();
    await logActivity(req, "IMPORT_SALES", `[${branch}] ${req.file.originalname} — ${summary.insertedCount} baris diimpor`);
    return res.json(summary);
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal mengimpor file." });
  }
});

importsRouter.post("/api/import/retur/preview", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  try {
    const branch = (req.body.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const preview = await previewSalesReturnFile(req.file.buffer, branch);
    return res.json(preview);
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal membaca file Excel." });
  }
});

importsRouter.post("/api/import/retur", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  try {
    let forceImportHashes: string[] = [];
    if (req.body.forceImportHashes) {
      const parsed = JSON.parse(req.body.forceImportHashes);
      if (!Array.isArray(parsed) || parsed.length > 500) {
        return res.status(400).json({ error: "forceImportHashes tidak valid." });
      }
      forceImportHashes = parsed.filter((h): h is string => typeof h === "string");
    }
    const branch = (req.body.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const summary = await importSalesReturnFile(req.file.originalname, req.file.buffer, forceImportHashes, branch);
    invalidateDefaults();
    await logActivity(req, "IMPORT_SALES_RETURN", `[${branch}] ${req.file.originalname} — ${summary.insertedCount} baris retur diimpor`);
    return res.json(summary);
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal mengimpor file retur." });
  }
});

importsRouter.get("/api/imports", requireFeature("import"), async (req, res) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { uploadedAt: "desc" },
    });
    return res.json(
      batches.map((b) => ({
        ...b,
        uploadedAt: b.uploadedAt.toISOString(),
        periodStart: b.periodStart ? b.periodStart.toISOString() : null,
        periodEnd: b.periodEnd ? b.periodEnd.toISOString() : null,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

importsRouter.get("/api/imports/:id", requireFeature("import"), async (req, res) => {
  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!batch) return res.status(404).json({ error: "Batch tidak ditemukan." });
    return res.json(batch);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

importsRouter.delete("/api/imports/:id", requireFeature("import"), async (req, res) => {
  try {
    await prisma.importBatch.delete({
      where: { id: Number(req.params.id) },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

importsRouter.post("/api/import/tartun", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  const dateStr = req.body.date;
  if (!dateStr) return res.status(400).json({ error: "Tanggal wajib diisi." });
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ error: "Tanggal tidak valid." });
  }

  try {
    const { rows, errors } = parseTartunBuffer(req.file.buffer);
    const summary = await importDailyMetric("TARTUN", date, rows);
    return res.json({
      filename: req.file.originalname,
      parsedRows: rows.length,
      parseErrors: errors,
      ...summary,
    });
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal memproses file Tarik Tunai." });
  }
});

importsRouter.post("/api/import/server", requireFeature("import"), upload.single("file"), async (req, res) => {
  const dateStr = req.body.date;
  if (!dateStr) return res.status(400).json({ error: "Tanggal wajib diisi." });
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ error: "Tanggal tidak valid." });
  }

  try {
    let rows: any[] = [];
    let errors: any[] = [];
    let filename = "teks tempel";

    if (req.file) {
      const parsed = parseServerBuffer(req.file.buffer);
      rows = parsed.rows;
      errors = parsed.errors;
      filename = req.file.originalname;
    } else if (req.body.text && typeof req.body.text === "string" && req.body.text.trim()) {
      const parsed = parseServerText(req.body.text);
      rows = parsed.rows;
      errors = parsed.errors;
    } else {
      return res.status(400).json({ error: "Isi teks atau unggah file terlebih dahulu." });
    }

    const summary = await importDailyMetric("SERVER", date, rows);
    return res.json({
      filename,
      parsedRows: rows.length,
      parseErrors: errors,
      ...summary,
    });
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal memproses file Server." });
  }
});

// ---- Daily import history (browse/delete already-imported Tartun/Server
// daily aggregates — distinct from the sales ImportBatch history above)

importsRouter.get("/api/daily-imports/tartun", requireFeature("import"), async (req, res) => {
  try {
    const rows = await prisma.tartunDaily.groupBy({
      by: ["tanggal"],
      _count: { id: true },
      _sum: { sales: true, trx: true },
      _max: { updatedAt: true },
      orderBy: { tanggal: "desc" },
    });
    return res.json(
      rows.map((r) => ({
        tanggal: r.tanggal.toISOString().slice(0, 10),
        outletCount: r._count.id,
        totalSales: Number(r._sum.sales ?? 0),
        totalTrx: r._sum.trx ?? 0,
        updatedAt: r._max.updatedAt?.toISOString() ?? null,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

importsRouter.delete("/api/daily-imports/tartun/:date", requireFeature("import"), async (req, res) => {
  try {
    const date = new Date(String(req.params.date));
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Tanggal tidak valid." });
    const { count } = await prisma.tartunDaily.deleteMany({
      where: { tanggal: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    return res.json({ ok: true, deletedCount: count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

importsRouter.get("/api/daily-imports/server", requireFeature("import"), async (req, res) => {
  try {
    const rows = await prisma.serverDaily.groupBy({
      by: ["tanggal"],
      _count: { id: true },
      _sum: { sales: true, trx: true },
      _max: { updatedAt: true },
      orderBy: { tanggal: "desc" },
    });
    return res.json(
      rows.map((r) => ({
        tanggal: r.tanggal.toISOString().slice(0, 10),
        outletCount: r._count.id,
        totalSales: Number(r._sum.sales ?? 0),
        totalTrx: r._sum.trx ?? 0,
        updatedAt: r._max.updatedAt?.toISOString() ?? null,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

importsRouter.delete("/api/daily-imports/server/:date", requireFeature("import"), async (req, res) => {
  try {
    const date = new Date(String(req.params.date));
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Tanggal tidak valid." });
    const { count } = await prisma.serverDaily.deleteMany({
      where: { tanggal: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    return res.json({ ok: true, deletedCount: count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
