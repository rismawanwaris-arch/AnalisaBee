// ==========================================
// MAPPINGS (master only) — raw POS "Item Group" → report category, and raw
// reseller/outlet alias → canonical Outlet.
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import type { ReportCategory } from "@/generated/prisma/client";
import { requireMaster, logActivity } from "../middleware";

export const mappingsRouter = Router();

mappingsRouter.get("/api/mappings/item-group", requireMaster, async (req, res) => {
  try {
    const list = await prisma.itemGroupMapping.findMany({
      orderBy: [{ isDefault: "asc" }, { itemGroup: "asc" }],
    });
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

mappingsRouter.delete("/api/mappings/item-group/:id", requireMaster, async (req, res) => {
  try {
    await prisma.itemGroupMapping.delete({ where: { id: Number(req.params.id) } });
    await logActivity(req, "GROUP_MAPPING_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

mappingsRouter.post("/api/mappings/outlet-alias", requireMaster, async (req, res) => {
  try {
    const { alias, outletId } = req.body;
    const al = String(alias || "").trim();
    const oid = Number(outletId);
    if (!al) return res.status(400).json({ error: "Alias wajib diisi." });
    if (Number.isNaN(oid)) return res.status(400).json({ error: "Pilih outlet." });

    const mapping = await prisma.outletAlias.upsert({
      where: { alias: al },
      update: { outletId: oid, isDefault: false },
      create: { alias: al, outletId: oid, isDefault: false },
    });
    const outlet = await prisma.outlet.findUnique({ where: { id: oid }, select: { name: true } });
    await logActivity(req, "ALIAS_ADD", `"${al}" → ${outlet?.name ?? oid}`);
    return res.json(mapping);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

mappingsRouter.delete("/api/mappings/outlet-alias/:id", requireMaster, async (req, res) => {
  try {
    await prisma.outletAlias.delete({ where: { id: Number(req.params.id) } });
    await logActivity(req, "ALIAS_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
