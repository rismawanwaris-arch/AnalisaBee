// ==========================================
// PUBLIC POINTS WALLBOARD (NO AUTH BY DESIGN)
// ==========================================
// Intentionally unauthenticated — a shared leaderboard meant to be opened on
// a tablet/TV at each outlet with no login. Reachable only inside the
// private Tailscale network the app itself is deployed on. Never add
// requireAuth/requireFeature/requireMaster here, and never let these routes
// return anything beyond points/ranking data (no revenue, no profit).
import { Router, type Request } from "express";
import { getPointPeriodSetting, computeMonthPeriod, computeWeekPeriod, getPublicPointsDashboard, getEmployeePointBreakdown } from "../../lib/queries/points";
import { todayStr } from "../../lib/dateDefaults";
import type { ReportCategory } from "@/generated/prisma/client";
import { publicPointsLimiter } from "../middleware";

export const publicPointsRouter = Router();

// Each period mode (Harian/Mingguan/Bulanan) on the public wallboard compares
// against its own target — a monthly target is naturally much larger than a
// daily one, so a single shared number doesn't make sense across views.
async function resolvePublicPointsPeriod(
  req: Request
): Promise<{ from: Date; to: Date; pointTarget: number; periodStartDay: number }> {
  const period = req.query.period === "day" || req.query.period === "week" ? req.query.period : "month";
  const dateParam = typeof req.query.date === "string" ? req.query.date : null;
  const dateStr = dateParam && !Number.isNaN(new Date(dateParam).getTime()) ? dateParam : todayStr();
  const setting = await getPointPeriodSetting();

  if (period === "day") {
    return { from: new Date(dateStr), to: new Date(dateStr), pointTarget: setting.pointTargetDaily, periodStartDay: setting.periodStartDay };
  }
  if (period === "week") {
    return { ...computeWeekPeriod(dateStr), pointTarget: setting.pointTargetWeekly, periodStartDay: setting.periodStartDay };
  }
  const [y, m] = dateStr.split("-").map(Number);
  const monthNum = m || new Date().getMonth() + 1;
  const yearNum = y || new Date().getFullYear();
  return {
    ...computeMonthPeriod(yearNum, monthNum, setting.periodStartDay),
    pointTarget: setting.pointTargetMonthly,
    periodStartDay: setting.periodStartDay,
  };
}

function parsePublicOutletId(req: Request): number | undefined {
  const raw = req.query.outletId ? Number(req.query.outletId) : undefined;
  return raw && Number.isInteger(raw) ? raw : undefined;
}

// Undefined = no category filter (mixes both, the only behavior before the
// Aksesoris/Petshop wallboard split existed). Same values as the internal
// pointsFeature/parsePointsCategory in routes/points.ts — kept separate since
// this route has no auth/feature-gating to hook a permission check into.
function parsePublicCategory(req: Request): ReportCategory | undefined {
  return req.query.category === "PETSHOP" || req.query.category === "AKSESORIS"
    ? req.query.category
    : undefined;
}

publicPointsRouter.get("/api/public/points/dashboard", publicPointsLimiter, async (req, res) => {
  try {
    const { from, to, pointTarget, periodStartDay } = await resolvePublicPointsPeriod(req);
    const data = await getPublicPointsDashboard(from, to, parsePublicOutletId(req), pointTarget, parsePublicCategory(req));
    // periodStartDay lets the page figure out which calendar month the
    // *currently running* cycle actually belongs to (see EmployeePointsDashboardPage) —
    // not sensitive, it's the same cut-off day already implied by `from`/`to` below.
    return res.json({ ...data, periodStartDay });
  } catch {
    // Never leak internal error details on a public, unauthenticated route.
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

publicPointsRouter.get("/api/public/points/employee/:id", publicPointsLimiter, async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const { from, to } = await resolvePublicPointsPeriod(req);
    const breakdown = await getEmployeePointBreakdown(
      employeeId,
      from,
      to,
      parsePublicOutletId(req),
      undefined,
      parsePublicCategory(req)
    );
    return res.json(breakdown);
  } catch {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});
