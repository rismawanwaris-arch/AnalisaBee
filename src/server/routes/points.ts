// ==========================================
// POINTS & INCENTIVES (internal) — leaderboard, per-employee breakdown, Excel
// export, and the master-only point-rule/exclusion management used by the
// Settings page. The public no-login wallboard lives in routes/publicPoints.ts.
// ==========================================
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  getLeaderboard,
  getLeaderboardExport,
  getEmployeePointBreakdown,
  getPointPeriodSetting,
  setPointPeriodSetting,
  computeMonthPeriod,
  listItemPointRules,
  upsertItemPointRule,
  deleteItemPointRule,
  listGroupPointDefaults,
  upsertGroupPointDefault,
  deleteGroupPointDefault,
  listItemPointExclusions,
  addItemPointExclusion,
  removeItemPointExclusion,
  listExcludedEmployees,
  excludeEmployee,
  includeEmployee,
  type PointTargetUpdate,
} from "../../lib/queries/points";
import { type FeatureKey } from "../../lib/features";
import type { ReportCategory } from "@/generated/prisma/client";
import { requireFeature, requireMaster, cacheBriefly, parseDateParam, logActivity } from "../middleware";

export const pointsRouter = Router();

// Both the leaderboard and its per-employee breakdown accept either an explicit
// from/to range or a year+month that's resolved against the configurable cycle
// start day. Shared here so all three point endpoints agree.
async function resolvePointPeriod(req: Request): Promise<{ from: Date; to: Date }> {
  const fromParam = parseDateParam(req.query.from);
  const toParam = parseDateParam(req.query.to);
  if (fromParam && toParam) return { from: fromParam, to: toParam };
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
  const { periodStartDay } = await getPointPeriodSetting();
  return computeMonthPeriod(year, month, periodStartDay);
}

// Points settings (period cut-off, rate, targets) stay shared across both
// cabang — only the leaderboard DATA is scoped by branch, not the incentive
// policy itself. The resolver also branches on `?category=` (Bandung only —
// Petshop and Aksesoris are separate menus/permissions there; Cimahi has no
// such split yet, so any category on a Cimahi request is ignored for gating,
// though the query itself still honours it if ever sent).
const pointsFeature = (req: Request): FeatureKey => {
  if (req.query.branch === "CIMAHI") return "points_cimahi";
  return req.query.category === "PETSHOP" ? "points_petshop" : "points";
};

// Always resolves to a concrete branch (defaulting to BANDUNG) — the admin
// leaderboard/export/breakdown endpoints must never silently fall back to
// mixing both cabang's sales. The public wallboard endpoint intentionally
// stays company-wide and does NOT use this — see routes/publicPoints.ts.
function parsePointsBranch(req: Request): "BANDUNG" | "CIMAHI" {
  return req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG";
}

// Undefined = no category filter (mixes every category, same as before this
// split existed) — only the Poin Aksesoris / Poin Petshop pages send one.
function parsePointsCategory(req: Request): ReportCategory | undefined {
  return req.query.category === "PETSHOP" || req.query.category === "AKSESORIS"
    ? req.query.category
    : undefined;
}

pointsRouter.get("/api/points/leaderboard", requireFeature(pointsFeature), async (req, res) => {
  try {
    const { from, to } = await resolvePointPeriod(req);
    const data = await getLeaderboard(from, to, parsePointsBranch(req), parsePointsCategory(req));
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Leaderboard + every employee's item breakdown in one payload — feeds the
// "Export Excel" button on the Poin & Insentif page.
pointsRouter.get("/api/points/leaderboard/export", requireFeature(pointsFeature), async (req, res) => {
  try {
    const { from, to } = await resolvePointPeriod(req);
    const data = await getLeaderboardExport(from, to, parsePointsBranch(req), parsePointsCategory(req));
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Feature-gated (not master-only): the leaderboard page also needs this to
// compute which calendar month the currently-running period belongs to.
pointsRouter.get("/api/points/settings", requireFeature(pointsFeature), cacheBriefly(30), async (req, res) => {
  try {
    const data = await getPointPeriodSetting();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Shared by PUT/POST below: pulls periodStartDay + the 3 optional per-period
// point targets out of the request body, validating each as an integer >= 0.
// Returns null (after writing the 400 response itself) on invalid input.
function parsePointSettingsBody(
  req: Request,
  res: Response
): { day: number; targets: PointTargetUpdate } | null {
  const { periodStartDay, pointTargetDaily, pointTargetWeekly, pointTargetMonthly, pointRupiahRate } = req.body;
  const day = Number(periodStartDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    res.status(400).json({ error: "Tanggal harus 1-31." });
    return null;
  }
  const targets: PointTargetUpdate = {};
  for (const [key, raw] of [
    ["daily", pointTargetDaily],
    ["weekly", pointTargetWeekly],
    ["monthly", pointTargetMonthly],
    ["rupiahRate", pointRupiahRate],
  ] as const) {
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      res.status(400).json({ error: "Target poin harus bilangan bulat >= 0." });
      return null;
    }
    targets[key] = n;
  }
  return { day, targets };
}

async function handlePointsSettingsWrite(req: Request, res: Response) {
  try {
    const parsed = parsePointSettingsBody(req, res);
    if (!parsed) return;
    const { day, targets } = parsed;
    await setPointPeriodSetting(day, targets);
    const targetLog = Object.entries(targets)
      .map(([k, v]) => `${k} → ${v}`)
      .join(", ");
    await logActivity(req, "PERIOD_UPDATE", `Tanggal mulai siklus → ${day}${targetLog ? `, target poin (${targetLog})` : ""}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

pointsRouter.put("/api/points/settings", requireMaster, handlePointsSettingsWrite);
pointsRouter.post("/api/points/settings", requireMaster, handlePointsSettingsWrite);

pointsRouter.get("/api/points/employee/:id", requireFeature(pointsFeature), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const { from, to } = await resolvePointPeriod(req);
    const breakdown = await getEmployeePointBreakdown(
      id,
      from,
      to,
      undefined,
      parsePointsBranch(req),
      parsePointsCategory(req)
    );
    return res.json(breakdown);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Master-only: the following point-rule/mapping GETs are consumed only by
// the Settings page's management sections, not by the public leaderboard.
pointsRouter.get("/api/points/items", requireMaster, async (req, res) => {
  try {
    const rules = await listItemPointRules();
    return res.json(rules);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.post("/api/points/items", requireMaster, async (req, res) => {
  try {
    const { pattern, points } = req.body;
    const p = String(pattern || "").trim();
    const pts = Number(points);
    if (!p) return res.status(400).json({ error: "Pola item wajib diisi." });
    if (!Number.isInteger(pts) || pts < 0) {
      return res.status(400).json({ error: "Poin harus integer >= 0." });
    }
    const rule = await upsertItemPointRule(p, pts);
    await logActivity(req, "ITEM_RULE_ADD", `"${p}" = ${pts} poin`);
    return res.json(rule);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.delete("/api/points/items/:id", requireMaster, async (req, res) => {
  try {
    await deleteItemPointRule(Number(req.params.id));
    await logActivity(req, "ITEM_RULE_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.get("/api/points/item-exclusions", requireMaster, async (req, res) => {
  try {
    const list = await listItemPointExclusions();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.post("/api/points/item-exclusions", requireMaster, async (req, res) => {
  try {
    const { pattern } = req.body;
    const p = String(pattern || "").trim();
    if (!p) return res.status(400).json({ error: "Pola item wajib diisi." });
    const excl = await addItemPointExclusion(p);
    await logActivity(req, "ITEM_EXCLUSION_ADD", `"${p}"`);
    return res.json(excl);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.delete("/api/points/item-exclusions/:id", requireMaster, async (req, res) => {
  try {
    await removeItemPointExclusion(Number(req.params.id));
    await logActivity(req, "ITEM_EXCLUSION_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.get("/api/points/group-defaults", requireMaster, async (req, res) => {
  try {
    const list = await listGroupPointDefaults();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.post("/api/points/group-defaults", requireMaster, async (req, res) => {
  try {
    const { itemGroup, points } = req.body;
    const g = String(itemGroup || "").trim();
    const pts = Number(points);
    if (!g) return res.status(400).json({ error: "Item Group wajib diisi." });
    if (!Number.isInteger(pts) || pts < 0) {
      return res.status(400).json({ error: "Poin harus integer >= 0." });
    }
    const row = await upsertGroupPointDefault(g, pts);
    await logActivity(req, "GROUP_DEFAULT_ADD", `"${g}" = ${pts} poin`);
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.delete("/api/points/group-defaults/:id", requireMaster, async (req, res) => {
  try {
    await deleteGroupPointDefault(Number(req.params.id));
    await logActivity(req, "GROUP_DEFAULT_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.get("/api/points/excluded-employees", requireMaster, async (req, res) => {
  try {
    const list = await listExcludedEmployees();
    return res.json(
      list.map((x) => ({
        id: x.id,
        employeeId: x.employeeId,
        employeeName: x.employee.name,
        reason: x.reason,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.post("/api/points/excluded-employees", requireMaster, async (req, res) => {
  try {
    const { employeeId, reason } = req.body;
    const empId = Number(employeeId);
    if (Number.isNaN(empId)) return res.status(400).json({ error: "Pilih pegawai." });
    const row = await excludeEmployee(empId, reason ? String(reason).trim() : undefined);
    const emp = await prisma.employee.findUnique({ where: { id: empId }, select: { name: true } });
    await logActivity(req, "EMPLOYEE_EXCLUSION_ADD", `${emp?.name ?? empId}${reason ? ` (${reason})` : ""}`);
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

pointsRouter.delete("/api/points/excluded-employees/:id", requireMaster, async (req, res) => {
  try {
    await includeEmployee(Number(req.params.id));
    await logActivity(req, "EMPLOYEE_EXCLUSION_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
