// ==========================================
// ITEMS — catalog search/browse and visibility toggle. Sales-transaction
// listing lives in routes/sales.ts.
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { searchItems, listAllItems, listItemsForVisibility, getItemDetail, getItemsByCategory, getItemFilterOptions } from "../../lib/queries/items";
import { resolveUserPermissions, hasFeature } from "../../lib/permissions";
import { requireAuth, requireAnyFeature, requireFeature, requireMaster, cacheBriefly, parseDateParam, logActivity, sendError } from "../middleware";

export const itemsRouter = Router();

itemsRouter.get("/api/items", requireAnyFeature(["items", "outlets", "employees", "transactions"]), async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
    const items = await searchItems(q, limit);
    return res.json(items);
  } catch (err) {
    return sendError(res, 500, err, "Gagal mencari item.");
  }
});

// Full catalog for pages that filter client-side (currently just ItemsPage) —
// cached briefly since the catalog only changes via import batches, not
// constantly. Kept separate from /api/items (which stays capped at 50 for
// dropdown-style typeahead) rather than overloading it with a huge `limit`.
itemsRouter.get("/api/items/all", requireFeature("items"), cacheBriefly(60), async (_req, res) => {
  try {
    const items = await listAllItems();
    return res.json(items);
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat katalog item.");
  }
});

// Full catalog INCLUDING hidden items + lifetime sales sums — for the
// "Visibilitas Item" panel in Settings. Registered before /api/items/:id so
// "visibility" isn't parsed as an id. Master-only, like the toggle itself.
itemsRouter.get("/api/items/visibility", requireMaster, async (_req, res) => {
  try {
    const items = await listItemsForVisibility();
    return res.json(items);
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat daftar visibilitas item.");
  }
});

itemsRouter.put("/api/items/:id/visibility", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { isHidden } = req.body;
    const updated = await prisma.item.update({
      where: { id },
      data: { isHidden: Boolean(isHidden) },
      select: { id: true, name: true, isHidden: true },
    });
    await logActivity(req, "ITEM_VISIBILITY", `${updated.name} → ${isHidden ? "disembunyikan" : "ditampilkan"}`);
    return res.json(updated);
  } catch (err) {
    return sendError(res, 500, err, "Gagal memperbarui visibilitas item.");
  }
});

itemsRouter.get("/api/items/by-category", requireFeature("item_categories"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const rows = await getItemsByCategory({ from, to });
    return res.json(rows);
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat kategori item.");
  }
});

// Not feature-gated to "items" — shared reference data for the Kategori/Merk
// filter dropdowns on Performa Outlet (which only requires "outlets"), same
// reasoning as /api/outlets and /api/employees. Registered before
// /api/items/:id so "filter-options" isn't parsed as an id.
itemsRouter.get("/api/items/filter-options", requireAnyFeature(["items", "outlets", "employees"]), cacheBriefly(60), async (_req, res) => {
  try {
    const options = await getItemFilterOptions();
    return res.json(options);
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat opsi filter item.");
  }
});

itemsRouter.get("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid" });

    const perms = await resolveUserPermissions(req.session!);
    if (hasFeature(perms, "items")) {
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to);
      const detail = await getItemDetail(id, { from, to });
      if (!detail) return res.status(404).json({ error: "Item tidak ditemukan" });
      return res.json(detail);
    }

    if (hasFeature(perms, "transactions")) {
      const item = await prisma.item.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, itemGroup: true, branch: true },
      });
      if (!item) return res.status(404).json({ error: "Item tidak ditemukan" });
      return res.json({ item });
    }

    return res.status(403).json({ error: "Akun Anda tidak memiliki akses ke fitur ini." });
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat detail item.");
  }
});
