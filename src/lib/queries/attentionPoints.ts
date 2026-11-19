import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import { getExcludedEmployeeIds } from "@/lib/queries/points";

export type BranchType = "BANDUNG" | "CIMAHI";

export interface AttentionProgramDTO {
  id: number;
  name: string;
  points: number;
  description: string | null;
  isActive: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionEmployeeOption {
  id: number;
  name: string;
  homeOutletName: string | null;
  homeBranch: BranchType | null;
  isExcluded: boolean;
}

export interface AttentionEntryDTO {
  id: number;
  tanggal: string;
  employeeId: number;
  employeeName: string;
  programId: number;
  programName: string;
  programIsActive: boolean;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  homeOutletName: string | null;
  homeBranch: BranchType | null;
}

export interface AttentionLeaderboardRow {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  homeBranch: BranchType | null;
  totalPoints: number;
  totalQty: number;
  entryCount: number;
}

export interface AttentionProgramBreakdownRow {
  programId: number;
  programName: string;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
}

export interface AttentionLeaderboardExportRow extends AttentionLeaderboardRow {
  programs: AttentionProgramBreakdownRow[];
}

export interface PublicAttentionCategoryRow {
  category: string;
  points: number;
  qty: number;
}

export interface PublicAttentionRow {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  totalPoints: number;
  pointItemsQty: number;
  achievementPct: number;
  categoryBreakdown: PublicAttentionCategoryRow[];
}

export interface PublicAttentionDashboard {
  rows: PublicAttentionRow[];
  from: string;
  to: string;
  pointTarget: number;
  outlets: { id: number; name: string }[];
}

export class AttentionValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Parses a strict YYYY-MM-DD string into a UTC midnight Date, throwing AttentionValidationError if invalid. */
export function parseDateOnly(raw: string): Date {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new AttentionValidationError("Format tanggal harus YYYY-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new AttentionValidationError("Tanggal tidak valid.");
  }
  return dt;
}

export interface OutletMeta {
  id: number;
  name: string;
  branch: BranchType;
}

export interface SaleOutletCount {
  employeeId: number;
  outletId: number;
  count: number;
}

export interface EmployeeSalesContext {
  homeOutletId: number | null;
  homeOutletName: string | null;
  homeBranch: BranchType | null;
  outletIds: Set<number>;
  branches: Set<BranchType>;
}

/**
 * Pure helper: derives each employee's home outlet & branch from sales counts.
 * Period sales take precedence; fallback sales are used only for employees with
 * zero sales in the current period so day-1 entries still map to their branch.
 */
export function buildEmployeeSalesContextMap(
  periodCounts: SaleOutletCount[],
  fallbackCounts: SaleOutletCount[],
  outletById: Map<number, OutletMeta>
): Map<number, EmployeeSalesContext> {
  const perEmpOutlets = new Map<number, Map<number, number>>();

  for (const row of periodCounts) {
    if (!outletById.has(row.outletId)) continue;
    const map = perEmpOutlets.get(row.employeeId) ?? new Map<number, number>();
    map.set(row.outletId, (map.get(row.outletId) ?? 0) + row.count);
    perEmpOutlets.set(row.employeeId, map);
  }

  // Group fallback sales only for employees with zero sales in the current period.
  const fallbackGrouped = new Map<number, Map<number, number>>();
  for (const row of fallbackCounts) {
    if (perEmpOutlets.has(row.employeeId)) continue;
    if (!outletById.has(row.outletId)) continue;
    const map = fallbackGrouped.get(row.employeeId) ?? new Map<number, number>();
    map.set(row.outletId, (map.get(row.outletId) ?? 0) + row.count);
    fallbackGrouped.set(row.employeeId, map);
  }
  for (const [empId, map] of fallbackGrouped) {
    perEmpOutlets.set(empId, map);
  }

  const result = new Map<number, EmployeeSalesContext>();
  for (const [empId, outletCounts] of perEmpOutlets) {
    let bestOutletId: number | null = null;
    let bestCount = -1;
    const outletIds = new Set<number>();
    const branches = new Set<BranchType>();

    for (const [oId, count] of outletCounts) {
      const meta = outletById.get(oId);
      if (!meta) continue;
      outletIds.add(oId);
      branches.add(meta.branch);
      if (count > bestCount) {
        bestCount = count;
        bestOutletId = oId;
      }
    }

    const bestMeta = bestOutletId !== null ? outletById.get(bestOutletId) ?? null : null;
    result.set(empId, {
      homeOutletId: bestMeta?.id ?? null,
      homeOutletName: bestMeta?.name ?? null,
      homeBranch: bestMeta?.branch ?? null,
      outletIds,
      branches,
    });
  }

  return result;
}

async function resolveEmployeeSalesContext(
  from: Date,
  to: Date,
  fallbackEmployeeIds: number[] = []
): Promise<{
  contextByEmployee: Map<number, EmployeeSalesContext>;
  outlets: OutletMeta[];
}> {
  const [outlets, periodAgg] = await Promise.all([
    prisma.outlet.findMany({
      where: { isHidden: false },
      select: { id: true, name: true, branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["employeeId", "outletId"],
      where: { tanggal: { gte: from, lte: to } },
      _count: { _all: true },
    }),
  ]);

  const outletList: OutletMeta[] = outlets.map((o) => ({
    id: o.id,
    name: o.name,
    branch: o.branch,
  }));
  const outletById = new Map(outletList.map((o) => [o.id, o]));

  const periodCounts: SaleOutletCount[] = periodAgg.map((r) => ({
    employeeId: r.employeeId,
    outletId: r.outletId,
    count: r._count._all,
  }));

  const seenInPeriod = new Set(periodCounts.map((r) => r.employeeId));
  const missingIds = [...new Set(fallbackEmployeeIds)].filter((id) => !seenInPeriod.has(id));

  let fallbackCounts: SaleOutletCount[] = [];
  if (missingIds.length > 0) {
    const fallbackAgg = await prisma.sale.groupBy({
      by: ["employeeId", "outletId"],
      where: { employeeId: { in: missingIds } },
      _count: { _all: true },
    });
    fallbackCounts = fallbackAgg.map((r) => ({
      employeeId: r.employeeId,
      outletId: r.outletId,
      count: r._count._all,
    }));
  }

  return {
    contextByEmployee: buildEmployeeSalesContextMap(periodCounts, fallbackCounts, outletById),
    outlets: outletList,
  };
}

// ==========================================
// PROGRAM MANAGEMENT
// ==========================================

export async function listAttentionPrograms(activeOnly = false): Promise<AttentionProgramDTO[]> {
  await ensureDefaults();
  const programs = await prisma.attentionProgram.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: { _count: { select: { entries: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    points: p.points,
    description: p.description,
    isActive: p.isActive,
    entryCount: p._count.entries,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function createAttentionProgram(input: {
  name: string;
  points: number;
  description?: string | null;
  isActive?: boolean;
}): Promise<AttentionProgramDTO> {
  await ensureDefaults();
  const name = input.name.trim();
  if (!name) throw new AttentionValidationError("Nama program wajib diisi.");
  if (!Number.isInteger(input.points) || input.points <= 0) {
    throw new AttentionValidationError("Nilai poin harus berupa bilangan bulat lebih dari 0.");
  }
  const existing = await prisma.attentionProgram.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    throw new AttentionValidationError(`Program "${existing.name}" sudah ada.`, 409);
  }
  const created = await prisma.attentionProgram.create({
    data: {
      name,
      points: input.points,
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
    },
    include: { _count: { select: { entries: true } } },
  });
  return {
    id: created.id,
    name: created.name,
    points: created.points,
    description: created.description,
    isActive: created.isActive,
    entryCount: created._count.entries,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updateAttentionProgram(
  id: number,
  input: {
    name?: string;
    points?: number;
    description?: string | null;
    isActive?: boolean;
  }
): Promise<AttentionProgramDTO> {
  await ensureDefaults();
  const existing = await prisma.attentionProgram.findUnique({ where: { id } });
  if (!existing) throw new AttentionValidationError("Program atensi tidak ditemukan.", 404);

  let nextName = existing.name;
  if (input.name !== undefined) {
    nextName = input.name.trim();
    if (!nextName) throw new AttentionValidationError("Nama program wajib diisi.");
    const dup = await prisma.attentionProgram.findFirst({
      where: { id: { not: id }, name: { equals: nextName, mode: "insensitive" } },
    });
    if (dup) throw new AttentionValidationError(`Program "${dup.name}" sudah ada.`, 409);
  }

  let nextPoints = existing.points;
  if (input.points !== undefined) {
    if (!Number.isInteger(input.points) || input.points <= 0) {
      throw new AttentionValidationError("Nilai poin harus berupa bilangan bulat lebih dari 0.");
    }
    nextPoints = input.points;
  }

  const updated = await prisma.attentionProgram.update({
    where: { id },
    data: {
      name: nextName,
      points: nextPoints,
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
    },
    include: { _count: { select: { entries: true } } },
  });

  return {
    id: updated.id,
    name: updated.name,
    points: updated.points,
    description: updated.description,
    isActive: updated.isActive,
    entryCount: updated._count.entries,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteAttentionProgram(id: number): Promise<void> {
  await ensureDefaults();
  const existing = await prisma.attentionProgram.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  });
  if (!existing) throw new AttentionValidationError("Program atensi tidak ditemukan.", 404);
  if (existing._count.entries > 0) {
    throw new AttentionValidationError(
      "Program sudah memiliki riwayat poin. Nonaktifkan saja agar data lama tetap terjaga.",
      409
    );
  }
  await prisma.attentionProgram.delete({ where: { id } });
}

// ==========================================
// EMPLOYEE OPTIONS & POINT ENTRIES
// ==========================================

export async function listAttentionEmployeeOptions(): Promise<AttentionEmployeeOption[]> {
  await ensureDefaults();
  const [employees, excludedIds, outlets, allSalesAgg] = await Promise.all([
    prisma.employee.findMany({
      where: { isHidden: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getExcludedEmployeeIds(),
    prisma.outlet.findMany({
      where: { isHidden: false },
      select: { id: true, name: true, branch: true },
    }),
    prisma.sale.groupBy({
      by: ["employeeId", "outletId"],
      _count: { _all: true },
    }),
  ]);

  const excludedSet = new Set(excludedIds);
  const outletById = new Map<number, OutletMeta>(
    outlets.map((o) => [o.id, { id: o.id, name: o.name, branch: o.branch }])
  );
  const ctxMap = buildEmployeeSalesContextMap(
    allSalesAgg.map((r) => ({ employeeId: r.employeeId, outletId: r.outletId, count: r._count._all })),
    [],
    outletById
  );

  return employees.map((e) => {
    const ctx = ctxMap.get(e.id);
    return {
      id: e.id,
      name: e.name,
      homeOutletName: ctx?.homeOutletName ?? null,
      homeBranch: ctx?.homeBranch ?? null,
      isExcluded: excludedSet.has(e.id),
    };
  });
}

export async function createAttentionPointEntry(input: {
  tanggal: string;
  employeeId: number;
  programId: number;
  qty: number;
  note?: string | null;
  createdBy?: string | null;
}): Promise<AttentionEntryDTO> {
  await ensureDefaults();
  const tanggal = parseDateOnly(input.tanggal);
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new AttentionValidationError("Jumlah (qty) harus berupa bilangan bulat minimal 1.");
  }

  const [employee, program] = await Promise.all([
    prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, name: true, isHidden: true } }),
    prisma.attentionProgram.findUnique({ where: { id: input.programId } }),
  ]);

  if (!employee || employee.isHidden) {
    throw new AttentionValidationError("Pegawai tidak ditemukan atau disembunyikan.", 404);
  }
  if (!program) {
    throw new AttentionValidationError("Program atensi tidak ditemukan.", 404);
  }
  if (!program.isActive) {
    throw new AttentionValidationError("Program atensi sedang tidak aktif dan tidak dapat dipilih.");
  }

  const pointsPerUnit = program.points;
  const totalPoints = input.qty * pointsPerUnit;

  const created = await prisma.attentionPointEntry.create({
    data: {
      tanggal,
      employeeId: employee.id,
      programId: program.id,
      qty: input.qty,
      pointsPerUnit,
      totalPoints,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    },
    include: {
      employee: { select: { name: true } },
      program: { select: { name: true, isActive: true } },
    },
  });

  const { contextByEmployee } = await resolveEmployeeSalesContext(tanggal, tanggal, [employee.id]);
  const ctx = contextByEmployee.get(employee.id);

  return {
    id: created.id,
    tanggal: created.tanggal.toISOString(),
    employeeId: created.employeeId,
    employeeName: created.employee.name,
    programId: created.programId,
    programName: created.program.name,
    programIsActive: created.program.isActive,
    qty: created.qty,
    pointsPerUnit: created.pointsPerUnit,
    totalPoints: created.totalPoints,
    note: created.note,
    createdBy: created.createdBy,
    createdAt: created.createdAt.toISOString(),
    homeOutletName: ctx?.homeOutletName ?? null,
    homeBranch: ctx?.homeBranch ?? null,
  };
}

export async function updateAttentionPointEntry(
  id: number,
  input: {
    tanggal?: string;
    employeeId?: number;
    programId?: number;
    qty?: number;
    note?: string | null;
  }
): Promise<AttentionEntryDTO> {
  await ensureDefaults();
  const existing = await prisma.attentionPointEntry.findUnique({ where: { id } });
  if (!existing) throw new AttentionValidationError("Data poin atensi tidak ditemukan.", 404);

  const tanggal = input.tanggal !== undefined ? parseDateOnly(input.tanggal) : existing.tanggal;
  const qty = input.qty !== undefined ? input.qty : existing.qty;
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new AttentionValidationError("Jumlah (qty) harus berupa bilangan bulat minimal 1.");
  }

  const employeeId = input.employeeId !== undefined ? input.employeeId : existing.employeeId;
  if (employeeId !== existing.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, isHidden: true } });
    if (!emp || emp.isHidden) {
      throw new AttentionValidationError("Pegawai tidak ditemukan atau disembunyikan.", 404);
    }
  }

  let programId = existing.programId;
  let pointsPerUnit = existing.pointsPerUnit;
  if (input.programId !== undefined && input.programId !== existing.programId) {
    const prog = await prisma.attentionProgram.findUnique({ where: { id: input.programId } });
    if (!prog) throw new AttentionValidationError("Program atensi tidak ditemukan.", 404);
    if (!prog.isActive) {
      throw new AttentionValidationError("Program atensi sedang tidak aktif dan tidak dapat dipilih.");
    }
    programId = prog.id;
    pointsPerUnit = prog.points;
  }

  const totalPoints = qty * pointsPerUnit;

  const updated = await prisma.attentionPointEntry.update({
    where: { id },
    data: {
      tanggal,
      employeeId,
      programId,
      qty,
      pointsPerUnit,
      totalPoints,
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
    },
    include: {
      employee: { select: { name: true } },
      program: { select: { name: true, isActive: true } },
    },
  });

  const { contextByEmployee } = await resolveEmployeeSalesContext(tanggal, tanggal, [employeeId]);
  const ctx = contextByEmployee.get(employeeId);

  return {
    id: updated.id,
    tanggal: updated.tanggal.toISOString(),
    employeeId: updated.employeeId,
    employeeName: updated.employee.name,
    programId: updated.programId,
    programName: updated.program.name,
    programIsActive: updated.program.isActive,
    qty: updated.qty,
    pointsPerUnit: updated.pointsPerUnit,
    totalPoints: updated.totalPoints,
    note: updated.note,
    createdBy: updated.createdBy,
    createdAt: updated.createdAt.toISOString(),
    homeOutletName: ctx?.homeOutletName ?? null,
    homeBranch: ctx?.homeBranch ?? null,
  };
}

export async function deleteAttentionPointEntry(id: number): Promise<void> {
  await ensureDefaults();
  const existing = await prisma.attentionPointEntry.findUnique({ where: { id } });
  if (!existing) throw new AttentionValidationError("Data poin atensi tidak ditemukan.", 404);
  await prisma.attentionPointEntry.delete({ where: { id } });
}

async function resolveEmployeeBranchAtDate(employeeId: number, refDate: Date): Promise<BranchType | null> {
  const start = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const { contextByEmployee } = await resolveEmployeeSalesContext(start, end, [employeeId]);
  return contextByEmployee.get(employeeId)?.homeBranch ?? null;
}

export async function getAttentionEmployeeBranch(employeeId: number): Promise<BranchType | null> {
  return resolveEmployeeBranchAtDate(employeeId, new Date());
}

export async function getAttentionEntryBranch(id: number): Promise<BranchType | null | undefined> {
  const entry = await prisma.attentionPointEntry.findUnique({
    where: { id },
    select: { employeeId: true, tanggal: true },
  });
  if (!entry) return undefined;
  return resolveEmployeeBranchAtDate(entry.employeeId, entry.tanggal);
}

export async function listAttentionPointEntries(filters: {
  from: Date;
  to: Date;
  employeeId?: number;
  programId?: number;
  search?: string;
}): Promise<AttentionEntryDTO[]> {
  await ensureDefaults();
  const search = filters.search?.trim();

  const entries = await prisma.attentionPointEntry.findMany({
    where: {
      tanggal: { gte: filters.from, lte: filters.to },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(search
        ? {
            OR: [
              { employee: { name: { contains: search, mode: "insensitive" } } },
              { program: { name: { contains: search, mode: "insensitive" } } },
              { note: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      employee: { select: { name: true } },
      program: { select: { name: true, isActive: true } },
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  const empIds = [...new Set(entries.map((e) => e.employeeId))];
  const { contextByEmployee } = await resolveEmployeeSalesContext(filters.from, filters.to, empIds);

  return entries.map((e) => {
    const ctx = contextByEmployee.get(e.employeeId);
    return {
      id: e.id,
      tanggal: e.tanggal.toISOString(),
      employeeId: e.employeeId,
      employeeName: e.employee.name,
      programId: e.programId,
      programName: e.program.name,
      programIsActive: e.program.isActive,
      qty: e.qty,
      pointsPerUnit: e.pointsPerUnit,
      totalPoints: e.totalPoints,
      note: e.note,
      createdBy: e.createdBy,
      createdAt: e.createdAt.toISOString(),
      homeOutletName: ctx?.homeOutletName ?? null,
      homeBranch: ctx?.homeBranch ?? null,
    };
  });
}

// ==========================================
// LEADERBOARD & BREAKDOWN (INTERNAL + PUBLIC)
// ==========================================

export async function getAttentionLeaderboard(
  from: Date,
  to: Date,
  branch?: BranchType
): Promise<{
  rows: AttentionLeaderboardRow[];
  unassignedCount: number;
  from: string;
  to: string;
}> {
  await ensureDefaults();
  const excludedIds = await getExcludedEmployeeIds();

  const entries = await prisma.attentionPointEntry.findMany({
    where: {
      tanggal: { gte: from, lte: to },
      employee: { isHidden: false },
      ...(excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {}),
    },
    select: {
      employeeId: true,
      qty: true,
      totalPoints: true,
      employee: { select: { name: true } },
    },
  });

  const empIds = [...new Set(entries.map((e) => e.employeeId))];
  const { contextByEmployee } = await resolveEmployeeSalesContext(from, to, empIds);

  const byEmployee = new Map<number, AttentionLeaderboardRow>();
  let unassignedCount = 0;

  for (const e of entries) {
    const ctx = contextByEmployee.get(e.employeeId);
    if (branch) {
      if (!ctx) {
        unassignedCount += 1;
        continue;
      }
      if (!ctx.branches.has(branch)) continue;
    }

    const existing = byEmployee.get(e.employeeId);
    if (existing) {
      existing.totalPoints += e.totalPoints;
      existing.totalQty += e.qty;
      existing.entryCount += 1;
    } else {
      byEmployee.set(e.employeeId, {
        employeeId: e.employeeId,
        employeeName: e.employee.name,
        outlet: ctx?.homeOutletName ?? null,
        homeBranch: ctx?.homeBranch ?? null,
        totalPoints: e.totalPoints,
        totalQty: e.qty,
        entryCount: 1,
      });
    }
  }

  const rows = [...byEmployee.values()].sort(
    (a, b) => b.totalPoints - a.totalPoints || a.employeeName.localeCompare(b.employeeName)
  );

  return {
    rows,
    unassignedCount,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export async function getAttentionEmployeeBreakdown(
  employeeId: number,
  from: Date,
  to: Date
): Promise<AttentionProgramBreakdownRow[]> {
  await ensureDefaults();
  const entries = await prisma.attentionPointEntry.findMany({
    where: {
      employeeId,
      tanggal: { gte: from, lte: to },
    },
    include: {
      program: { select: { name: true } },
    },
  });

  const grouped = new Map<string, AttentionProgramBreakdownRow>();
  for (const e of entries) {
    const key = `${e.programId}:${e.pointsPerUnit}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.qty += e.qty;
      existing.totalPoints += e.totalPoints;
    } else {
      grouped.set(key, {
        programId: e.programId,
        programName: e.program.name,
        qty: e.qty,
        pointsPerUnit: e.pointsPerUnit,
        totalPoints: e.totalPoints,
      });
    }
  }

  return [...grouped.values()].sort(
    (a, b) => b.totalPoints - a.totalPoints || a.programName.localeCompare(b.programName)
  );
}

export async function getAttentionLeaderboardExport(
  from: Date,
  to: Date,
  branch?: BranchType
): Promise<{
  rows: AttentionLeaderboardExportRow[];
  entries: AttentionEntryDTO[];
  from: string;
  to: string;
}> {
  const [leaderboard, entries] = await Promise.all([
    getAttentionLeaderboard(from, to, branch),
    listAttentionPointEntries({ from, to }),
  ]);

  const rawEntries = await prisma.attentionPointEntry.findMany({
    where: {
      tanggal: { gte: from, lte: to },
      employeeId: { in: leaderboard.rows.map((r) => r.employeeId) },
    },
    include: { program: { select: { name: true } } },
  });

  const breakdownByEmployee = new Map<number, Map<string, AttentionProgramBreakdownRow>>();
  for (const e of rawEntries) {
    let progMap = breakdownByEmployee.get(e.employeeId);
    if (!progMap) {
      progMap = new Map();
      breakdownByEmployee.set(e.employeeId, progMap);
    }
    const key = `${e.programId}:${e.pointsPerUnit}`;
    const existing = progMap.get(key);
    if (existing) {
      existing.qty += e.qty;
      existing.totalPoints += e.totalPoints;
    } else {
      progMap.set(key, {
        programId: e.programId,
        programName: e.program.name,
        qty: e.qty,
        pointsPerUnit: e.pointsPerUnit,
        totalPoints: e.totalPoints,
      });
    }
  }

  const rows: AttentionLeaderboardExportRow[] = leaderboard.rows.map((r) => {
    const progMap = breakdownByEmployee.get(r.employeeId);
    const programs = progMap
      ? [...progMap.values()].sort((a, b) => b.totalPoints - a.totalPoints)
      : [];
    return { ...r, programs };
  });

  const filteredEntries = branch
    ? entries.filter((e) => e.homeBranch === branch || e.homeBranch === null)
    : entries;

  return {
    rows,
    entries: filteredEntries,
    from: leaderboard.from,
    to: leaderboard.to,
  };
}

export async function getPublicAttentionDashboard(
  from: Date,
  to: Date,
  outletId?: number,
  branch?: BranchType
): Promise<PublicAttentionDashboard> {
  await ensureDefaults();
  const excludedIds = await getExcludedEmployeeIds();

  const [roster, entries] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isHidden: false,
        ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
      },
      select: { id: true, name: true },
    }),
    prisma.attentionPointEntry.findMany({
      where: {
        tanggal: { gte: from, lte: to },
        employee: { isHidden: false },
        ...(excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {}),
      },
      include: {
        program: { select: { name: true } },
      },
    }),
  ]);

  const entryEmpIds = [...new Set(entries.map((e) => e.employeeId))];
  const { contextByEmployee, outlets } = await resolveEmployeeSalesContext(from, to, entryEmpIds);

  const statsByEmployee = new Map<
    number,
    { totalPoints: number; totalQty: number; programs: Map<string, PublicAttentionCategoryRow> }
  >();

  for (const e of entries) {
    let stat = statsByEmployee.get(e.employeeId);
    if (!stat) {
      stat = { totalPoints: 0, totalQty: 0, programs: new Map() };
      statsByEmployee.set(e.employeeId, stat);
    }
    stat.totalPoints += e.totalPoints;
    stat.totalQty += e.qty;
    const catRow = stat.programs.get(e.program.name) ?? {
      category: e.program.name,
      points: 0,
      qty: 0,
    };
    catRow.points += e.totalPoints;
    catRow.qty += e.qty;
    stat.programs.set(e.program.name, catRow);
  }

  const relevantRoster = outletId
    ? roster.filter((emp) => contextByEmployee.get(emp.id)?.outletIds.has(outletId) ?? false)
    : branch
    ? roster.filter((emp) => contextByEmployee.get(emp.id)?.branches.has(branch) ?? false)
    : roster;

  const rows: PublicAttentionRow[] = relevantRoster.map((emp) => {
    const stat = statsByEmployee.get(emp.id);
    const ctx = contextByEmployee.get(emp.id);
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      outlet: ctx?.homeOutletName ?? null,
      totalPoints: stat?.totalPoints ?? 0,
      pointItemsQty: stat?.totalQty ?? 0,
      achievementPct: 0,
      categoryBreakdown: stat
        ? [...stat.programs.values()].sort((a, b) => b.points - a.points)
        : [],
    };
  });

  rows.sort((a, b) => b.totalPoints - a.totalPoints || a.employeeName.localeCompare(b.employeeName));

  const branchOutlets = branch
    ? outlets.filter((o) => o.branch === branch).map((o) => ({ id: o.id, name: o.name }))
    : outlets.map((o) => ({ id: o.id, name: o.name }));

  return {
    rows,
    from: from.toISOString(),
    to: to.toISOString(),
    pointTarget: 0,
    outlets: branchOutlets,
  };
}
