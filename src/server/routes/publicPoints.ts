// ==========================================
// PUBLIC POINTS WALLBOARD (NO AUTH BY DESIGN)
// ==========================================
// Intentionally unauthenticated — a shared leaderboard meant to be opened on
// a tablet/TV at each outlet with no login. Reachable only inside the
// private Tailscale network the app itself is deployed on. Never add
// requireAuth/requireFeature/requireMaster here, and never let these routes
// return anything beyond points/ranking data (no revenue, no profit).
import { Router, type Request } from "express";
import { getPointPeriodSetting, computeCurrentMonthPeriod, getPublicPointsDashboard, getEmployeePointBreakdown } from "../../lib/queries/points";
import type { ReportCategory } from "@/generated/prisma/client";
import { publicPointsLimiter } from "../middleware";

export const publicPointsRouter = Router();

// The wallboard's date filter is a plain range (no Harian/Mingguan/Bulanan
// preset anymore) — pass ?from=&to= to pick one explicitly. Omit both to get
// the month-cycle period (per PointSettings.periodStartDay) currently
// running, e.g. periodStartDay=29 defaults to "29th – 28th". The displayed
// target is always pointTargetMonthly regardless of the range picked — the
// other two target settings (harian/mingguan) exist only for the internal
// /points leaderboard's own Harian/Mingguan tabs, not this page.
async function resolvePublicPointsPeriod(
  req: Request
): Promise<{ from: Date; to: Date; pointTarget: number; periodStartDay: number }> {
  const setting = await getPointPeriodSetting();
  const fromParam = typeof req.query.from === "string" ? req.query.from : null;
  const toParam = typeof req.query.to === "string" ? req.query.to : null;
  const fromValid = fromParam && !Number.isNaN(new Date(fromParam).getTime());
  const toValid = toParam && !Number.isNaN(new Date(toParam).getTime());

  const { from, to } = fromValid && toValid
    ? { from: new Date(fromParam), to: new Date(toParam) }
    : computeCurrentMonthPeriod(setting.periodStartDay);

  return { from, to, pointTarget: setting.pointTargetMonthly, periodStartDay: setting.periodStartDay };
}

function parsePublicOutletId(req: Request): number | undefined {
  const raw = req.query.outletId ? Number(req.query.outletId) : undefined;
  return raw && Number.isInteger(raw) ? raw : undefined;
}

function parsePublicBranch(req: Request): "BANDUNG" | "CIMAHI" | undefined {
  if (req.query.branch === "CIMAHI" || req.query.branch === "BANDUNG") return req.query.branch;
  return undefined;
}

// Undefined = no category filter (mixes all three, the only behavior before
// the Aksesoris/Petshop/SP-Voucher wallboard split existed). Same values as
// the internal pointsFeature/parsePointsCategory in routes/points.ts — kept
// separate since this route has no auth/feature-gating to hook a permission
// check into.
function parsePublicCategory(req: Request): ReportCategory | undefined {
  return req.query.category === "PETSHOP" ||
    req.query.category === "AKSESORIS" ||
    req.query.category === "SP_VOUCHER"
    ? req.query.category
    : undefined;
}

publicPointsRouter.get("/api/public/points/dashboard", publicPointsLimiter, async (req, res) => {
  try {
    const { from, to, pointTarget, periodStartDay } = await resolvePublicPointsPeriod(req);
    const branch = parsePublicBranch(req);
    const data = await getPublicPointsDashboard(from, to, parsePublicOutletId(req), pointTarget, parsePublicCategory(req), branch);
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
    const branch = parsePublicBranch(req);
    const breakdown = await getEmployeePointBreakdown(
      employeeId,
      from,
      to,
      parsePublicOutletId(req),
      branch,
      parsePublicCategory(req)
    );
    return res.json(breakdown);
  } catch {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});
