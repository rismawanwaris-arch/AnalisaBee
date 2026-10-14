import { Router, type Request, type Response } from "express";
import {
  getPurchaseSummary,
  getPurchaseByVendors,
  getPurchaseInvoices,
  getPurchaseInvoiceDetail,
  getTopPurchasedItems,
  listPurchasedVendors,
  listPurchasedOutlets,
  importPurchases,
  deletePurchaseInvoice,
  listPurchaseBatches,
  deletePurchaseBatch,
  type PurchaseFilters,
} from "../../lib/queries/purchases";
import { parsePurchaseBuffer, parsePurchaseText } from "../../lib/parsePurchases";
import { requireFeature, requireMaster, parseDateParam, logActivity } from "../middleware";
import { upload } from "../uploads";

export const purchasesRouter = Router();

function parsePurchaseFilters(req: Request): PurchaseFilters {
  const from = parseDateParam(req.query.from);
  const to = parseDateParam(req.query.to);
  const vendor = req.query.vendor ? String(req.query.vendor).trim() : undefined;
  const outletName = req.query.outlet ? String(req.query.outlet).trim() : undefined;
  const search = req.query.q ? String(req.query.q).trim() : undefined;

  return { from, to, vendor, outletName, search };
}

// Summary KPI
purchasesRouter.get("/api/purchases/summary", requireFeature("purchases"), async (req: Request, res: Response) => {
  try {
    const filters = parsePurchaseFilters(req);
    const summary = await getPurchaseSummary(filters);
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat ringkasan pembelian." });
  }
});

// Breakdown per Vendor / Supplier
purchasesRouter.get("/api/purchases/vendors", requireFeature("purchases"), async (req: Request, res: Response) => {
  try {
    const filters = parsePurchaseFilters(req);
    const vendors = await getPurchaseByVendors(filters);
    return res.json(vendors);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat data suplier." });
  }
});

// List Invoices / Nota
purchasesRouter.get("/api/purchases/invoices", requireFeature("purchases"), async (req: Request, res: Response) => {
  try {
    const filters = parsePurchaseFilters(req);
    const page = req.query.page ? Math.max(1, parseInt(String(req.query.page), 10)) : 1;
    const pageSize = req.query.pageSize ? Math.min(200, Math.max(1, parseInt(String(req.query.pageSize), 10))) : 50;

    const data = await getPurchaseInvoices(filters, page, pageSize);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat daftar faktur pembelian." });
  }
});

// Top Purchased Items
purchasesRouter.get("/api/purchases/top-items", requireFeature("purchases"), async (req: Request, res: Response) => {
  try {
    const filters = parsePurchaseFilters(req);
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const items = await getTopPurchasedItems(filters, limit);
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat item pembelian." });
  }
});

// Filter options (vendors & outlets)
purchasesRouter.get("/api/purchases/options", requireFeature("purchases"), async (_req: Request, res: Response) => {
  try {
    const [vendors, outlets] = await Promise.all([listPurchasedVendors(), listPurchasedOutlets()]);
    return res.json({ vendors, outlets });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat opsi suplier." });
  }
});

// Single Invoice Detail (Nota Detail)
purchasesRouter.get("/api/purchases/invoices/:id", requireFeature("purchases"), async (req: Request, res: Response) => {
  try {
    const idParam = String(req.params.id);
    const idNum = Number(idParam);
    const detail = await getPurchaseInvoiceDetail(isNaN(idNum) ? idParam : idNum);
    if (!detail) {
      return res.status(404).json({ error: "Faktur pembelian tidak ditemukan." });
    }
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat detail nota pembelian." });
  }
});

// Import purchase invoices via file upload or pasted text
purchasesRouter.post(
  "/api/purchases/import",
  requireMaster,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      let parsed;
      let filename = "pasted_purchases.csv";

      if (req.file) {
        filename = req.file.originalname;
        parsed = parsePurchaseBuffer(req.file.buffer);
      } else if (req.body.text && typeof req.body.text === "string") {
        parsed = parsePurchaseText(req.body.text);
      } else {
        return res.status(400).json({ error: "File Excel/CSV atau teks data pembelian wajib disertakan." });
      }

      if (parsed.invoices.length === 0) {
        return res.status(400).json({
          error: "Tidak ada faktur pembelian yang valid ditemukan dalam data yang diunggah.",
          details: parsed.errors.map((e) => `Baris ${e.row}: ${e.message}`),
        });
      }

      const summary = await importPurchases(parsed.invoices, filename, parsed.errors.length);

      await logActivity(
        req,
        "PURCHASE_IMPORT",
        `Import ${summary.totalInvoices} nota (${summary.totalItems} baris item) dari "${filename}"`
      );

      return res.json({
        ok: true,
        ...summary,
        errorsCount: parsed.errors.length,
        errors: parsed.errors.slice(0, 10),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Gagal memproses import data pembelian." });
    }
  }
);

// Upload history (Riwayat Batch Import Pembelian)
purchasesRouter.get("/api/purchases/batches", requireFeature("purchases"), async (_req: Request, res: Response) => {
  try {
    return res.json(await listPurchaseBatches());
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal memuat riwayat import pembelian." });
  }
});

// Delete a whole upload batch (cascade-deletes its invoices + items)
purchasesRouter.delete("/api/purchases/batches/:id", requireMaster, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID batch tidak valid." });

    const deleted = await deletePurchaseBatch(id);
    if (!deleted) return res.status(404).json({ error: "Batch import pembelian tidak ditemukan." });

    await logActivity(
      req,
      "PURCHASE_BATCH_DELETE",
      `Hapus batch "${deleted.filename}" (${deleted.invoiceCount} nota)`
    );
    return res.json({ ok: true, ...deleted });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal menghapus batch import pembelian." });
  }
});

// Delete an invoice
purchasesRouter.delete("/api/purchases/invoices/:id", requireMaster, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID faktur tidak valid." });

    await deletePurchaseInvoice(id);
    await logActivity(req, "PURCHASE_DELETE", `id=${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal menghapus faktur pembelian." });
  }
});
