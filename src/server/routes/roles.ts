// ==========================================
// CUSTOM ROLES (master only) — permission templates for "admin"-tier accounts.
// ==========================================
import { Router } from "express";
import { listCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole, RoleError } from "../../lib/queries/roles";
import { requireMaster, sendError, logActivity } from "../middleware";

export const rolesRouter = Router();

rolesRouter.get("/api/roles", requireMaster, async (_req, res) => {
  try {
    return res.json(await listCustomRoles());
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat daftar peran.");
  }
});

rolesRouter.post("/api/roles", requireMaster, async (req, res) => {
  try {
    const role = await createCustomRole({
      name: req.body?.name,
      permissions: req.body?.permissions,
    });
    await logActivity(req, "BUAT_PERAN", role.name);
    return res.status(201).json(role);
  } catch (err) {
    if (err instanceof RoleError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal membuat peran.");
  }
});

rolesRouter.put("/api/roles/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const role = await updateCustomRole(id, {
      name: req.body?.name,
      permissions: req.body?.permissions,
    });
    await logActivity(req, "UBAH_PERAN", role.name);
    return res.json(role);
  } catch (err) {
    if (err instanceof RoleError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah peran.");
  }
});

rolesRouter.delete("/api/roles/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    await deleteCustomRole(id);
    await logActivity(req, "HAPUS_PERAN", String(id));
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof RoleError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal menghapus peran.");
  }
});
