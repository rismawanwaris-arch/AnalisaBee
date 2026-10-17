// ==========================================
// EMPLOYEES
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getEmployeeList, getEmployeeDetail, getEmployeeSummary } from "../../lib/queries/employees";
import { requireAuth, requireFeature, requireMaster, cacheBriefly, parseDateParam, logActivity } from "../middleware";

export const employeesRouter = Router();

employeesRouter.get("/api/employees", requireAuth, cacheBriefly(30), async (req, res) => {
  try {
    const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    const list = await getEmployeeList(includeHidden);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

employeesRouter.get("/api/employees/summary", requireFeature("employees"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const outletId = req.query.outletId ? Number(req.query.outletId) : undefined;
    const subtotalMin = req.query.subtotalMin ? Number(req.query.subtotalMin) : undefined;
    const subtotalMax = req.query.subtotalMax ? Number(req.query.subtotalMax) : undefined;
    const itemGroup = typeof req.query.itemGroup === "string" && req.query.itemGroup ? req.query.itemGroup : undefined;
    const brand = typeof req.query.brand === "string" && req.query.brand ? req.query.brand : undefined;
    const itemKeyword = typeof req.query.itemKeyword === "string" && req.query.itemKeyword.trim()
      ? req.query.itemKeyword.trim()
      : undefined;
    const rows = await getEmployeeSummary({ from, to, itemId, outletId, subtotalMin, subtotalMax, itemGroup, brand, itemKeyword });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

employeesRouter.put("/api/employees/:id/visibility", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { isHidden } = req.body;
    const updated = await prisma.employee.update({
      where: { id },
      data: { isHidden: Boolean(isHidden) },
      select: { id: true, name: true, isHidden: true },
    });
    await logActivity(req, "EMPLOYEE_VISIBILITY", `${updated.name} → ${isHidden ? "disembunyikan" : "ditampilkan"}`);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

employeesRouter.get("/api/employees/:id", requireFeature("employees"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const outletId = req.query.outletId ? Number(req.query.outletId) : undefined;
    const itemGroup = typeof req.query.itemGroup === "string" && req.query.itemGroup ? req.query.itemGroup : undefined;
    const brand = typeof req.query.brand === "string" && req.query.brand ? req.query.brand : undefined;
    const itemKeyword = typeof req.query.itemKeyword === "string" && req.query.itemKeyword.trim()
      ? req.query.itemKeyword.trim()
      : undefined;
    const detail = await getEmployeeDetail(id, { from, to, itemId, outletId, itemGroup, brand, itemKeyword });
    if (!detail) return res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
