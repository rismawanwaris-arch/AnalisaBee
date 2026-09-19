// ==========================================
// EMPLOYEES
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getEmployeeList, getEmployeeDetail } from "../../lib/queries/employees";
import { requireAuth, requireFeature, requireMaster, cacheBriefly, logActivity } from "../middleware";

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
    const detail = await getEmployeeDetail(id);
    if (!detail) return res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
