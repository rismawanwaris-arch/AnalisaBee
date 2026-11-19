// ==========================================
// SYSTEM STATUS & DASHBOARD
// ==========================================
import { Router, type Request } from "express";
import { getSystemStatus } from "../../lib/queries/systemStatus";
import { getDashboardSummary } from "../../lib/queries/dashboard";
import { type FeatureKey } from "../../lib/features";
import { requireAuth, requireFeature, parseDateParam, sendError } from "../middleware";

export const dashboardRouter = Router();

// Not feature-gated: AppLayout fetches this for the sidebar widget on every
// page, not just the Dashboard, so any authenticated account needs it.
dashboardRouter.get("/api/status", requireAuth, async (req, res) => {
  try {
    const status = await getSystemStatus();
    return res.json(status);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat status sistem.");
  }
});

const dashboardFeature = (req: Request): FeatureKey =>
  req.query.branch === "CIMAHI" ? "dashboard_cimahi" : "dashboard";

dashboardRouter.get("/api/dashboard", requireFeature(dashboardFeature), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const rawOutletId = req.query.outletId ? Number(req.query.outletId) : undefined;
    const outletId = rawOutletId && Number.isInteger(rawOutletId) && rawOutletId > 0 ? rawOutletId : undefined;
    const branch = req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG";
    const summary = await getDashboardSummary({ from, to, outletId, branch });
    return res.json(summary);
  } catch (err: unknown) {
    return sendError(res, 500, err, "Gagal memuat ringkasan dashboard.");
  }
});
