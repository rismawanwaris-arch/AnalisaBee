// ==========================================
// BACKUP & RESTORE (master only) — full data dump/restore and settings-only
// dump/restore, both as downloadable/uploadable JSON.
// ==========================================
import { Router } from "express";
import { exportDataBackup, restoreDataBackup, exportSettingsBackup, restoreSettingsBackup, BackupError } from "../../lib/backup";
import { requireMaster, sendError, logActivity } from "../middleware";
import { uploadBackup } from "../uploads";

export const backupRouter = Router();

backupRouter.get("/api/backup/data", requireMaster, async (req, res) => {
  try {
    const backup = await exportDataBackup();
    const filename = `analisabee-data-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await logActivity(req, "BACKUP_DATA_EXPORT", `${backup.counts.sales} sale, ${backup.counts.outlets} outlet`);
    return res.json(backup);
  } catch (err) {
    return sendError(res, 500, err, "Gagal membuat backup data.");
  }
});

backupRouter.post("/api/backup/data/restore", requireMaster, uploadBackup.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File backup wajib diunggah." });
  try {
    const payload = JSON.parse(req.file.buffer.toString("utf-8"));
    const result = await restoreDataBackup(payload);
    await logActivity(
      req,
      "BACKUP_DATA_RESTORE",
      `${req.file.originalname}${result.skippedAliases || result.skippedPointsExclusions ? ` (lewati ${result.skippedAliases} alias, ${result.skippedPointsExclusions} pengecualian poin)` : ""}`,
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BackupError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: "File bukan JSON yang valid." });
    return sendError(res, 500, err, "Gagal memulihkan data.");
  }
});

backupRouter.get("/api/backup/settings", requireMaster, async (req, res) => {
  try {
    const backup = await exportSettingsBackup();
    const filename = `analisabee-pengaturan-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await logActivity(req, "BACKUP_SETTINGS_EXPORT", `${backup.counts.targets} target, ${backup.counts.customRoles} peran`);
    return res.json(backup);
  } catch (err) {
    return sendError(res, 500, err, "Gagal membuat backup pengaturan.");
  }
});

backupRouter.post("/api/backup/settings/restore", requireMaster, uploadBackup.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File backup wajib diunggah." });
  try {
    const payload = JSON.parse(req.file.buffer.toString("utf-8"));
    await restoreSettingsBackup(payload);
    await logActivity(req, "BACKUP_SETTINGS_RESTORE", req.file.originalname);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof BackupError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: "File bukan JSON yang valid." });
    return sendError(res, 500, err, "Gagal memulihkan pengaturan.");
  }
});
