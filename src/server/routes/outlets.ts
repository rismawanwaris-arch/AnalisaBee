// ==========================================
// OUTLETS
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getOutletList, getOutletDetail, getOutletSummary } from "../../lib/queries/outlets";
import { requireAuth, requireFeature, requireMaster, cacheBriefly, parseDateParam, logActivity } from "../middleware";

export const outletsRouter = Router();

// Not feature-gated: this is a shared outlet-name reference used as a filter
// dropdown by several pages (Dashboard, Transactions, Jam Operasional,
// Settings), not exclusive to the Performa Outlet page.
outletsRouter.get("/api/outlets", requireAuth, cacheBriefly(30), async (req, res) => {
  try {
    const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    const branch = req.query.branch === "CIMAHI" || req.query.branch === "BANDUNG" ? req.query.branch : undefined;
    const list = await getOutletList(includeHidden, branch);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

outletsRouter.get("/api/outlets/summary", requireFeature("outlets"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const subtotalMin = req.query.subtotalMin ? Number(req.query.subtotalMin) : undefined;
    const subtotalMax = req.query.subtotalMax ? Number(req.query.subtotalMax) : undefined;
    const itemGroup = typeof req.query.itemGroup === "string" && req.query.itemGroup ? req.query.itemGroup : undefined;
    const brand = typeof req.query.brand === "string" && req.query.brand ? req.query.brand : undefined;
    const rows = await getOutletSummary({ from, to, itemId, employeeId, subtotalMin, subtotalMax, itemGroup, brand });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

outletsRouter.put("/api/outlets/:id/branch", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { branch } = req.body;
    if (branch !== "BANDUNG" && branch !== "CIMAHI") {
      return res.status(400).json({ error: "branch harus BANDUNG atau CIMAHI" });
    }
    const updated = await prisma.outlet.update({
      where: { id },
      data: { branch },
      select: { id: true, name: true, branch: true },
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

outletsRouter.put("/api/outlets/:id/visibility", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { isHidden } = req.body;
    const updated = await prisma.outlet.update({
      where: { id },
      data: { isHidden: Boolean(isHidden) },
      select: { id: true, name: true, isHidden: true },
    });
    await logActivity(req, "OUTLET_VISIBILITY", `${updated.name} → ${isHidden ? "disembunyikan" : "ditampilkan"}`);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

outletsRouter.get("/api/outlets/:id", requireFeature("outlets"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const detail = await getOutletDetail(id);
    if (!detail) return res.status(404).json({ error: "Outlet tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
