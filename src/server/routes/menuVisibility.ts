import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ensureDefaults } from "../../lib/ensureDefaults";
import { requireAuth, requireMaster, logActivity, sendError } from "../middleware";
import { REQUIRED_MENU_HREFS } from "../../lib/sidebarMenus";

export const menuVisibilityRouter = Router();

menuVisibilityRouter.get("/api/settings/menu-visibility", requireAuth, async (_req, res) => {
  try {
    await ensureDefaults();
    const setting = await prisma.pointSettings.findUnique({
      where: { id: 1 },
      select: { hiddenMenuItems: true },
    });
    return res.json({ hidden: setting?.hiddenMenuItems ?? [] });
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat status visibilitas menu sidebar.");
  }
});

menuVisibilityRouter.put("/api/settings/menu-visibility", requireMaster, async (req, res) => {
  try {
    await ensureDefaults();
    const { hidden, href, isHidden } = req.body;

    const current = await prisma.pointSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, periodStartDay: 1, hiddenMenuItems: [] },
      select: { hiddenMenuItems: true },
    });

    let nextHidden: string[] = [];

    if (Array.isArray(hidden)) {
      // Direct replace with array of hidden hrefs, stripping any required items (like /settings)
      nextHidden = hidden
        .filter((item): item is string => typeof item === "string")
        .filter((h) => !REQUIRED_MENU_HREFS.has(h));
    } else if (typeof href === "string" && typeof isHidden === "boolean") {
      // Toggle a single item
      if (REQUIRED_MENU_HREFS.has(href)) {
        return res.status(400).json({ error: "Menu ini wajib ditampilkan dan tidak dapat disembunyikan." });
      }
      const set = new Set(current.hiddenMenuItems);
      if (isHidden) {
        set.add(href);
      } else {
        set.delete(href);
      }
      nextHidden = Array.from(set);
    } else {
      return res.status(400).json({ error: "Format permintaan tidak valid." });
    }

    const updated = await prisma.pointSettings.update({
      where: { id: 1 },
      data: { hiddenMenuItems: nextHidden },
      select: { hiddenMenuItems: true },
    });

    const summary = typeof href === "string"
      ? `${href} → ${isHidden ? "disembunyikan" : "ditampilkan"}`
      : `${nextHidden.length} menu disembunyikan`;

    await logActivity(req, "MENU_VISIBILITY", summary);

    return res.json({ ok: true, hidden: updated.hiddenMenuItems });
  } catch (err) {
    return sendError(res, 500, err, "Gagal memperbarui visibilitas menu sidebar.");
  }
});

menuVisibilityRouter.post("/api/settings/menu-visibility/reset", requireMaster, async (req, res) => {
  try {
    await ensureDefaults();
    const updated = await prisma.pointSettings.upsert({
      where: { id: 1 },
      update: { hiddenMenuItems: [] },
      create: { id: 1, periodStartDay: 1, hiddenMenuItems: [] },
      select: { hiddenMenuItems: true },
    });

    await logActivity(req, "MENU_VISIBILITY", "Reset semua menu menjadi tampil");
    return res.json({ ok: true, hidden: updated.hiddenMenuItems });
  } catch (err) {
    return sendError(res, 500, err, "Gagal mereset visibilitas menu sidebar.");
  }
});
