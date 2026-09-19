// ==========================================
// ACCOUNT & SESSION MANAGEMENT (master only)
// ==========================================
import { Router } from "express";
import {
  listUsers,
  createUser,
  updateUserRole,
  updateUserActive,
  updateUserCustomRole,
  resetUserPassword,
  deleteUser,
  listActiveSessions,
  UserError,
} from "../../lib/queries/users";
import { revokeSessionById } from "../../lib/session";
import { requireMaster, sendError, logActivity } from "../middleware";

export const accountsRouter = Router();

accountsRouter.get("/api/users", requireMaster, async (_req, res) => {
  try {
    return res.json(await listUsers());
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat daftar akun.");
  }
});

accountsRouter.post("/api/users", requireMaster, async (req, res) => {
  try {
    const user = await createUser({
      username: req.body?.username,
      password: req.body?.password,
      role: req.body?.role,
      displayName: req.body?.displayName,
      roleId: req.body?.roleId,
    });
    await logActivity(req, "BUAT_AKUN", `${user.username} (${user.role})`);
    return res.status(201).json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal membuat akun.");
  }
});

accountsRouter.put("/api/users/:id/custom-role", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await updateUserCustomRole(id, req.body?.roleId);
    await logActivity(req, "UBAH_PERAN_KUSTOM_AKUN", `${user.username} → ${user.customRole?.name ?? "akses penuh"}`);
    return res.json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah peran akun.");
  }
});

accountsRouter.put("/api/users/:id/role", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await updateUserRole(id, req.body?.role);
    await logActivity(req, "UBAH_ROLE_AKUN", `${user.username} → ${user.role}`);
    return res.json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah role.");
  }
});

accountsRouter.put("/api/users/:id/active", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await updateUserActive(id, req.body?.isActive);
    await logActivity(req, user.isActive ? "AKTIFKAN_AKUN" : "NONAKTIFKAN_AKUN", user.username);
    return res.json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah status akun.");
  }
});

accountsRouter.put("/api/users/:id/password", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await resetUserPassword(id, req.body?.password);
    await logActivity(req, "RESET_PASSWORD_AKUN", user.username);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mereset kata sandi.");
  }
});

accountsRouter.delete("/api/users/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  if (req.session!.userId === id) {
    return res.status(400).json({ error: "Tidak bisa menghapus akun Anda sendiri." });
  }
  try {
    await deleteUser(id);
    await logActivity(req, "HAPUS_AKUN", String(id));
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal menghapus akun.");
  }
});

accountsRouter.get("/api/sessions", requireMaster, async (req, res) => {
  try {
    const sessions = await listActiveSessions();
    return res.json(
      sessions.map((s) => ({ ...s, isCurrent: s.id === req.session!.sessionId })),
    );
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat sesi aktif.");
  }
});

accountsRouter.delete("/api/sessions/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  if (id === req.session!.sessionId) {
    return res.status(400).json({ error: "Gunakan tombol keluar untuk mengakhiri sesi Anda sendiri." });
  }
  try {
    const revoked = await revokeSessionById(id);
    if (!revoked) return res.status(404).json({ error: "Sesi tidak ditemukan atau sudah berakhir." });
    await logActivity(req, "KICK_SESI", String(id));
    return res.json({ ok: true });
  } catch (err) {
    return sendError(res, 500, err, "Gagal mengakhiri sesi.");
  }
});
