// ==========================================
// ACTIVITY LOG — audit trail of every logActivity() call across the app
// (logins, visibility toggles, rule changes, imports, backups, etc).
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireFeature, parseDateParam } from "../middleware";

export const activityLogRouter = Router();

activityLogRouter.get("/api/activity-log", requireFeature("activity_log"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
