// ==========================================
// ITEMS — catalog search/browse and visibility toggle. Sales-transaction
// listing lives in routes/sales.ts.
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { searchItems, listAllItems, listItemsForVisibility, getItemDetail, getItemsByCategory, getItemFilterOptions } from "../../lib/queries/items";
import { requireAuth, requireFeature, requireMaster, cacheBriefly, parseDateParam, logActivity } from "../middleware";

export const itemsRouter = Router();

itemsRouter.get("/api/items", requireFeature("items"), async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Number(req.query.limit) || 20;
    const items = await searchItems(q, limit);
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Full catalog for pages that filter client-side (currently just ItemsPage) —
// cached briefly since the catalog only changes via import batches, not
// constantly. Kept separate from /api/items (which stays capped at 50 for
// dropdown-style typeahead) rather than overloading it with a huge `limit`.
itemsRouter.get("/api/items/all", requireFeature("items"), cacheBriefly(60), async (req, res) => {
  try {
    const items = await listAllItems();
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Full catalog INCLUDING hidden items + lifetime sales sums — for the
// "Visibilitas Item" panel in Settings. Registered before /api/items/:id so
// "visibility" isn't parsed as an id. Master-only, like the toggle itself.
itemsRouter.get("/api/items/visibility", requireMaster, async (_req, res) => {
  try {
    const items = await listItemsForVisibility();
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

itemsRouter.put("/api/items/:id/visibility", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { isHidden } = req.body;
    const updated = await prisma.item.update({
      where: { id },
      data: { isHidden: Boolean(isHidden) },
      select: { id: true, name: true, isHidden: true },
    });
    await logActivity(req, "ITEM_VISIBILITY", `${updated.name} → ${isHidden ? "disembunyikan" : "ditampilkan"}`);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

itemsRouter.get("/api/items/by-category", requireFeature("item_categories"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const rows = await getItemsByCategory({ from, to });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Not feature-gated to "items" — shared reference data for the Kategori/Merk
// filter dropdowns on Performa Outlet (which only requires "outlets"), same
// reasoning as /api/outlets and /api/employees. Registered before
// /api/items/:id so "filter-options" isn't parsed as an id.
itemsRouter.get("/api/items/filter-options", requireAuth, cacheBriefly(60), async (_req, res) => {
  try {
    const options = await getItemFilterOptions();
    return res.json(options);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

itemsRouter.get("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const detail = await getItemDetail(id, { from, to });
    if (!detail) return res.status(404).json({ error: "Item tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
