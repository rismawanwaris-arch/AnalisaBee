// ==========================================
// MAPPINGS (master only) — raw POS "Item Group" → report category, and raw
// reseller/outlet alias → canonical Outlet.
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import type { ReportCategory } from "@/generated/prisma/client";
import { createOutletAlias, listUnmatchedMetrics } from "../../lib/queries/mappings";
import { requireMaster, logActivity, sendError } from "../middleware";

export const mappingsRouter = Router();

mappingsRouter.get("/api/mappings/item-group", requireMaster, async (req, res) => {
  try {
    const list = await prisma.itemGroupMapping.findMany({
      orderBy: [{ isDefault: "asc" }, { itemGroup: "asc" }],
    });
    return res.json(list);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat pemetaan item group.");
  }
});

mappingsRouter.post("/api/mappings/item-group", requireMaster, async (req, res) => {
  try {
    const { itemGroup, category } = req.body;
    const group = String(itemGroup || "").trim();
    if (!group) return res.status(400).json({ error: "Item Group wajib diisi." });
    const validCats: ReportCategory[] = ["PETSHOP", "AKSESORIS", "SP_VOUCHER"];
    if (!validCats.includes(category)) {
      return res.status(400).json({ error: "Kategori tidak valid." });
    }

    const mapping = await prisma.itemGroupMapping.upsert({
      where: { itemGroup: group },
      update: { category, isDefault: false },
      create: { itemGroup: group, category, isDefault: false },
    });
    await logActivity(req, "GROUP_MAPPING_ADD", `"${group}" → ${category}`);
    return res.json(mapping);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal menyimpan pemetaan item group.");
  }
});

mappingsRouter.delete("/api/mappings/item-group/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID tidak valid." });
  try {
    await prisma.itemGroupMapping.delete({ where: { id } });
    await logActivity(req, "GROUP_MAPPING_DELETE", `id=${id}`);
    return res.json({ ok: true });
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal menghapus pemetaan item group.");
  }
});

// ── Point Group Mappings (Poin & Papan Poin) ──
mappingsRouter.get("/api/mappings/point-group", requireMaster, async (req, res) => {
  try {
    const list = await prisma.pointGroupMapping.findMany({
      orderBy: [{ isDefault: "asc" }, { itemGroup: "asc" }],
    });
    return res.json(list);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat pemetaan grup poin.");
  }
});

mappingsRouter.post("/api/mappings/point-group", requireMaster, async (req, res) => {
  try {
    const { itemGroup, category } = req.body;
    const group = String(itemGroup || "").trim();
    if (!group) return res.status(400).json({ error: "Item Group wajib diisi." });
    const validCats: ReportCategory[] = ["PETSHOP", "AKSESORIS", "SP_VOUCHER"];
    if (!validCats.includes(category)) {
      return res.status(400).json({ error: "Kategori tidak valid." });
    }

    const mapping = await prisma.pointGroupMapping.upsert({
      where: { itemGroup: group },
      update: { category, isDefault: false },
      create: { itemGroup: group, category, isDefault: false },
    });
    await logActivity(req, "POINT_GROUP_MAPPING_ADD", `"${group}" → ${category}`);
    return res.json(mapping);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal menyimpan pemetaan grup poin.");
  }
});

mappingsRouter.delete("/api/mappings/point-group/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID tidak valid." });
  try {
    await prisma.pointGroupMapping.delete({ where: { id } });
    await logActivity(req, "POINT_GROUP_MAPPING_DELETE", `id=${id}`);
    return res.json({ ok: true });
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal menghapus pemetaan grup poin.");
  }
});

mappingsRouter.get("/api/mappings/unmatched-metrics", requireMaster, async (req, res) => {
  try {
    const list = await listUnmatchedMetrics();
    return res.json(list);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat metrik harian belum dipetakan.");
  }
});

mappingsRouter.get("/api/mappings/outlet-alias", requireMaster, async (req, res) => {
  try {
    const list = await prisma.outletAlias.findMany({
      include: { outlet: { select: { name: true } } },
      orderBy: { alias: "asc" },
    });
    return res.json(
      list.map((a) => ({
        id: a.id,
        alias: a.alias,
        outletId: a.outletId,
        outletName: a.outlet.name,
        isDefault: a.isDefault,
      }))
    );
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat daftar alias outlet.");
  }
});

mappingsRouter.post("/api/mappings/outlet-alias", requireMaster, async (req, res) => {
  try {
    const { alias, outletId } = req.body;
    const al = String(alias || "").trim();
    const oid = Number(outletId);
    if (!al) return res.status(400).json({ error: "Alias wajib diisi." });
    if (!Number.isInteger(oid) || oid <= 0) return res.status(400).json({ error: "Pilih outlet." });

    const { mapping, transferredCount } = await createOutletAlias(al, oid);
    const outlet = await prisma.outlet.findUnique({ where: { id: oid }, select: { name: true } });
    await logActivity(
      req,
      "ALIAS_ADD",
      `"${al}" → ${outlet?.name ?? oid}${transferredCount > 0 ? ` (${transferredCount} data penampungan dipindahkan)` : ""}`
    );
    return res.json({ ...mapping, transferredCount });
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal menyimpan alias outlet.");
  }
});

mappingsRouter.delete("/api/mappings/outlet-alias/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID tidak valid." });
  try {
    await prisma.outletAlias.delete({ where: { id } });
    await logActivity(req, "ALIAS_DELETE", `id=${id}`);
    return res.json({ ok: true });
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal menghapus alias outlet.");
  }
});
