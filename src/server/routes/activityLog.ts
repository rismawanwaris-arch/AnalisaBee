// ==========================================
// ACTIVITY LOG — audit trail of every logActivity() call across the app
// (logins, visibility toggles, rule changes, imports, backups, etc).
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireFeature, parseDateParam, sendError } from "../middleware";

export const activityLogRouter = Router();

activityLogRouter.get("/api/activity-log", requireFeature("activity_log"), async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100;
    const rawOffset = Number(req.query.offset);
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : undefined;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: new Date(to.getTime() + 86400000) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return res.json({ logs, total, limit, offset });
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat log aktivitas.");
  }
});
