// ==========================================
// ATTENTION POINTS ("Papan Poin Atensi") — standalone program-based points
// independent of POS sales / transaction numbers.
// ==========================================
import { Router, type Request } from "express";
import {
  AttentionValidationError,
  listAttentionPrograms,
  createAttentionProgram,
  updateAttentionProgram,
  deleteAttentionProgram,
  listAttentionEmployeeOptions,
  createAttentionPointEntry,
  updateAttentionPointEntry,
  deleteAttentionPointEntry,
  getAttentionEmployeeBranch,
  getAttentionEntryBranch,
  listAttentionPointEntries,
  getAttentionLeaderboard,
  getAttentionLeaderboardExport,
  getAttentionEmployeeBreakdown,
  getPublicAttentionDashboard,
  type BranchType,
} from "../../lib/queries/attentionPoints";
import {
  getPointPeriodSetting,
  computeMonthPeriod,
  computeCurrentMonthPeriod,
} from "../../lib/queries/points";
import { type FeatureKey } from "../../lib/features";
import { resolveUserPermissions, hasFeature } from "../../lib/permissions";
import {
  requireFeature,
  publicPointsLimiter,
  parseDateParam,
  logActivity,
  sendError,
} from "../middleware";

export const attentionPointsRouter = Router();

const attentionFeature = (req: Request): FeatureKey =>
  req.query.branch === "CIMAHI" ? "points_cimahi_atensi" : "points_atensi";

function parseBranchParam(val: unknown): BranchType | undefined {
  if (val === "CIMAHI" || val === "BANDUNG") return val;
  return undefined;
}

async function getAttentionBranchScope(req: Request): Promise<BranchType | undefined> {
  if (!req.session) return undefined;
  const perms = await resolveUserPermissions(req.session);
  const canBandung = hasFeature(perms, "points_atensi");
  const canCimahi = hasFeature(perms, "points_cimahi_atensi");
  if (canBandung && !canCimahi) return "BANDUNG";
  if (!canBandung && canCimahi) return "CIMAHI";
  return undefined;
}

async function resolvePeriod(req: Request): Promise<{ from: Date; to: Date }> {
  const fromParam = parseDateParam(req.query.from);
  const toParam = parseDateParam(req.query.to);
  if (fromParam && toParam) return { from: fromParam, to: toParam };
  const setting = await getPointPeriodSetting();
  if (req.query.year || req.query.month) {
    const rawYear = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const rawMonth = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : new Date().getFullYear();
    const month = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : new Date().getMonth() + 1;
    return computeMonthPeriod(year, month, setting.periodStartDay);
  }
  return computeCurrentMonthPeriod(setting.periodStartDay);
}

function handleAttentionError(res: any, err: unknown) {
  if (err instanceof AttentionValidationError) {
    return res.status(err.status).json({ error: err.message });
  }
  return sendError(res, 500, err);
}

// ==========================================
// INTERNAL ENDPOINTS (authenticated + feature-gated)
// ==========================================

attentionPointsRouter.get("/api/points/attention/programs", requireFeature(attentionFeature), async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === "1" || req.query.activeOnly === "true";
    const programs = await listAttentionPrograms(activeOnly);
    return res.json(programs);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.post("/api/points/attention/programs", requireFeature(attentionFeature), async (req, res) => {
  try {
    const { name, points, description, isActive } = req.body ?? {};
    const created = await createAttentionProgram({
      name: typeof name === "string" ? name : "",
      points: Number(points),
      description: typeof description === "string" ? description : null,
      isActive: isActive === undefined ? true : Boolean(isActive),
    });
    await logActivity(
      req,
      "CREATE_ATTENTION_PROGRAM",
      `${created.name} (+${created.points} poin, ${created.isActive ? "aktif" : "nonaktif"})`
    );
    return res.status(201).json(created);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.put("/api/points/attention/programs/:id", requireFeature(attentionFeature), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID program tidak valid." });
  try {
    const { name, points, description, isActive } = req.body ?? {};
    const updated = await updateAttentionProgram(id, {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(points !== undefined ? { points: Number(points) } : {}),
      ...(description !== undefined ? { description: description === null ? null : String(description) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    });
    await logActivity(
      req,
      "UPDATE_ATTENTION_PROGRAM",
      `id=${id} ${updated.name} (+${updated.points} poin, ${updated.isActive ? "aktif" : "nonaktif"})`
    );
    return res.json(updated);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.delete("/api/points/attention/programs/:id", requireFeature(attentionFeature), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID program tidak valid." });
  try {
    await deleteAttentionProgram(id);
    await logActivity(req, "DELETE_ATTENTION_PROGRAM", `id=${id}`);
    return res.json({ ok: true });
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.get("/api/points/attention/employees", requireFeature(attentionFeature), async (_req, res) => {
  try {
    const employees = await listAttentionEmployeeOptions();
    return res.json(employees);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.get("/api/points/attention/entries", requireFeature(attentionFeature), async (req, res) => {
  try {
    const { from, to } = await resolvePeriod(req);
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const programId = req.query.programId ? Number(req.query.programId) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const [entries, branchScope] = await Promise.all([
      listAttentionPointEntries({
        from,
        to,
        employeeId: employeeId && Number.isInteger(employeeId) ? employeeId : undefined,
        programId: programId && Number.isInteger(programId) ? programId : undefined,
        search,
      }),
      getAttentionBranchScope(req),
    ]);
    const filteredEntries = branchScope
      ? entries.filter((e) => e.homeBranch === null || e.homeBranch === branchScope)
      : entries;
    return res.json({ entries: filteredEntries, from: from.toISOString(), to: to.toISOString() });
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.post("/api/points/attention/entries", requireFeature(attentionFeature), async (req, res) => {
  try {
    const { tanggal, employeeId, programId, qty, note } = req.body ?? {};
    const parsedEmployeeId = Number(employeeId);
    const parsedProgramId = Number(programId);
    const parsedQty = Number(qty);
    if (
      !Number.isInteger(parsedEmployeeId) ||
      parsedEmployeeId <= 0 ||
      !Number.isInteger(parsedProgramId) ||
      parsedProgramId <= 0 ||
      !Number.isInteger(parsedQty) ||
      parsedQty <= 0
    ) {
      return res.status(400).json({ error: "employeeId, programId, dan qty harus berupa bilangan bulat positif." });
    }
    const branchScope = await getAttentionBranchScope(req);
    if (branchScope) {
      const empBranch = await getAttentionEmployeeBranch(parsedEmployeeId);
      if (empBranch !== null && empBranch !== branchScope) {
        return res.status(403).json({ error: "Anda tidak memiliki akses untuk menambah entri pegawai cabang lain." });
      }
    }
    const created = await createAttentionPointEntry({
      tanggal: typeof tanggal === "string" ? tanggal : "",
      employeeId: parsedEmployeeId,
      programId: parsedProgramId,
      qty: parsedQty,
      note: typeof note === "string" ? note : null,
      createdBy: req.session?.username ?? null,
    });
    await logActivity(
      req,
      "CREATE_ATTENTION_POINT",
      `${created.employeeName} — ${created.programName} (${created.qty}x × ${created.pointsPerUnit} = +${created.totalPoints} poin, ${created.tanggal.slice(0, 10)})`
    );
    return res.status(201).json(created);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.put("/api/points/attention/entries/:id", requireFeature(attentionFeature), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID entri tidak valid." });
  try {
    const { tanggal, employeeId, programId, qty, note } = req.body ?? {};
    if (employeeId !== undefined && (!Number.isInteger(Number(employeeId)) || Number(employeeId) <= 0)) {
      return res.status(400).json({ error: "employeeId tidak valid." });
    }
    if (programId !== undefined && (!Number.isInteger(Number(programId)) || Number(programId) <= 0)) {
      return res.status(400).json({ error: "programId tidak valid." });
    }
    if (qty !== undefined && (!Number.isInteger(Number(qty)) || Number(qty) <= 0)) {
      return res.status(400).json({ error: "qty harus berupa bilangan bulat positif." });
    }

    const branchScope = await getAttentionBranchScope(req);
    if (branchScope) {
      const entryBranch = await getAttentionEntryBranch(id);
      if (entryBranch === undefined) {
        return res.status(404).json({ error: "Data poin atensi tidak ditemukan." });
      }
      if (entryBranch !== null && entryBranch !== branchScope) {
        return res.status(403).json({ error: "Anda tidak memiliki akses untuk mengubah entri cabang lain." });
      }
      if (employeeId !== undefined) {
        const targetEmpBranch = await getAttentionEmployeeBranch(Number(employeeId));
        if (targetEmpBranch !== null && targetEmpBranch !== branchScope) {
          return res.status(403).json({ error: "Anda tidak memiliki akses untuk memindahkan entri ke pegawai cabang lain." });
        }
      }
    }

    const updated = await updateAttentionPointEntry(id, {
      ...(tanggal !== undefined ? { tanggal: String(tanggal) } : {}),
      ...(employeeId !== undefined ? { employeeId: Number(employeeId) } : {}),
      ...(programId !== undefined ? { programId: Number(programId) } : {}),
      ...(qty !== undefined ? { qty: Number(qty) } : {}),
      ...(note !== undefined ? { note: note === null ? null : String(note) } : {}),
    });
    await logActivity(
      req,
      "UPDATE_ATTENTION_POINT",
      `id=${id} ${updated.employeeName} — ${updated.programName} (${updated.qty}x = +${updated.totalPoints} poin)`
    );
    return res.json(updated);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.delete("/api/points/attention/entries/:id", requireFeature(attentionFeature), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID entri tidak valid." });
  try {
    const branchScope = await getAttentionBranchScope(req);
    if (branchScope) {
      const entryBranch = await getAttentionEntryBranch(id);
      if (entryBranch === undefined) {
        return res.status(404).json({ error: "Data poin atensi tidak ditemukan." });
      }
      if (entryBranch !== null && entryBranch !== branchScope) {
        return res.status(403).json({ error: "Anda tidak memiliki akses untuk menghapus entri cabang lain." });
      }
    }

    await deleteAttentionPointEntry(id);
    await logActivity(req, "DELETE_ATTENTION_POINT", `id=${id}`);
    return res.json({ ok: true });
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.get("/api/points/attention/leaderboard", requireFeature(attentionFeature), async (req, res) => {
  try {
    const { from, to } = await resolvePeriod(req);
    const branchScope = await getAttentionBranchScope(req);
    const branch = branchScope ?? parseBranchParam(req.query.branch) ?? "BANDUNG";
    const data = await getAttentionLeaderboard(from, to, branch);
    return res.json(data);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.get("/api/points/attention/leaderboard/export", requireFeature(attentionFeature), async (req, res) => {
  try {
    const { from, to } = await resolvePeriod(req);
    const branchScope = await getAttentionBranchScope(req);
    const branch = branchScope ?? parseBranchParam(req.query.branch) ?? "BANDUNG";
    const data = await getAttentionLeaderboardExport(from, to, branch);
    return res.json(data);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

attentionPointsRouter.get("/api/points/attention/employee/:id", requireFeature(attentionFeature), async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: "ID pegawai tidak valid." });
  try {
    const { from, to } = await resolvePeriod(req);
    const rows = await getAttentionEmployeeBreakdown(employeeId, from, to);
    return res.json(rows);
  } catch (err) {
    return handleAttentionError(res, err);
  }
});

// ==========================================
// PUBLIC WALLBOARD ENDPOINTS (no auth by design — TV/tablet leaderboard)
// ==========================================

attentionPointsRouter.get("/api/public/points/attention/dashboard", publicPointsLimiter, async (req, res) => {
  try {
    const setting = await getPointPeriodSetting();
    const fromParam = parseDateParam(req.query.from);
    const toParam = parseDateParam(req.query.to);
    const { from, to } =
      fromParam && toParam
        ? { from: fromParam, to: toParam }
        : computeCurrentMonthPeriod(setting.periodStartDay);

    const rawOutletId = req.query.outletId ? Number(req.query.outletId) : undefined;
    const outletId = rawOutletId && Number.isInteger(rawOutletId) ? rawOutletId : undefined;
    const branch = parseBranchParam(req.query.branch);

    const data = await getPublicAttentionDashboard(from, to, outletId, branch);
    return res.json({ ...data, periodStartDay: setting.periodStartDay });
  } catch {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

attentionPointsRouter.get("/api/public/points/attention/employee/:id", publicPointsLimiter, async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const setting = await getPointPeriodSetting();
    const fromParam = parseDateParam(req.query.from);
    const toParam = parseDateParam(req.query.to);
    const { from, to } =
      fromParam && toParam
        ? { from: fromParam, to: toParam }
        : computeCurrentMonthPeriod(setting.periodStartDay);

    const rows = await getAttentionEmployeeBreakdown(employeeId, from, to);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});
