import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import type { ReportCategory } from "@/generated/prisma/client";

// Lets the leaderboard/export/breakdown/wallboard queries scope points to one report
// category (PETSHOP vs AKSESORIS vs SP_VOUCHER) using PointGroupMapping specifically configured
// for points & papan poin (independent from Target Harian's ItemGroupMapping).
async function getItemGroupsForCategory(category: ReportCategory): Promise<string[]> {
  const rows = await prisma.pointGroupMapping.findMany({
    where: { category },
    select: { itemGroup: true },
  });
  return rows.map((r) => r.itemGroup);
}

export function toDateStr(d: Date | string): string {
  if (typeof d === "string") {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export async function listItemPointRules() {
  await ensureDefaults();
  return prisma.itemPoint.findMany({ orderBy: [{ pattern: "asc" }, { startDate: "desc" }] });
}

export async function upsertItemPointRule(pattern: string, points: number, startDate?: string | Date) {
  const dateObj = startDate ? new Date(startDate) : new Date();
  const dateStr = toDateStr(dateObj);
  const cleanDate = new Date(`${dateStr}T00:00:00.000Z`);

  return prisma.itemPoint.upsert({
    where: { pattern_startDate: { pattern, startDate: cleanDate } },
    update: { points, isDefault: false },
    create: { pattern, points, startDate: cleanDate, isDefault: false },
  });
}

export async function bulkUpsertItemPointRules(
  items: Array<{ pattern: string; points: number }>,
  startDate?: string | Date
) {
  const dateObj = startDate ? new Date(startDate) : new Date();
  const dateStr = toDateStr(dateObj);
  const cleanDate = new Date(`${dateStr}T00:00:00.000Z`);

  const results = [];
  for (const item of items) {
    const trimmed = item.pattern.trim();
    if (!trimmed) continue;
    const res = await prisma.itemPoint.upsert({
      where: { pattern_startDate: { pattern: trimmed, startDate: cleanDate } },
      update: { points: item.points, isDefault: false },
      create: { pattern: trimmed, points: item.points, startDate: cleanDate, isDefault: false },
    });
    results.push(res);
  }
  return results;
}

export async function deleteItemPointRule(id: number) {
  await prisma.itemPoint.delete({ where: { id } });
}

export async function listGroupPointDefaults() {
  await ensureDefaults();
  return prisma.itemGroupPointDefault.findMany({ orderBy: { itemGroup: "asc" } });
}

export async function upsertGroupPointDefault(itemGroup: string, points: number) {
  return prisma.itemGroupPointDefault.upsert({
    where: { itemGroup },
    update: { points },
    create: { itemGroup, points },
  });
}

export async function deleteGroupPointDefault(id: number) {
  await prisma.itemGroupPointDefault.delete({ where: { id } });
}

export async function listItemPointExclusions() {
  return prisma.itemPointExclusion.findMany({ orderBy: { pattern: "asc" } });
}

export async function addItemPointExclusion(pattern: string) {
  return prisma.itemPointExclusion.upsert({
    where: { pattern },
    update: {},
    create: { pattern },
  });
}

export async function removeItemPointExclusion(id: number) {
  await prisma.itemPointExclusion.delete({ where: { id } });
}

export async function listExcludedEmployees() {
  return prisma.pointsExclusion.findMany({
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { employee: { name: "asc" } },
  });
}

export async function excludeEmployee(employeeId: number, reason?: string) {
  return prisma.pointsExclusion.upsert({
    where: { employeeId },
    update: { reason },
    create: { employeeId, reason },
  });
}

export async function includeEmployee(id: number) {
  await prisma.pointsExclusion.delete({ where: { id } });
}

export async function getExcludedEmployeeIds(): Promise<number[]> {
  const rows = await prisma.pointsExclusion.findMany({ select: { employeeId: true } });
  return rows.map((r) => r.employeeId);
}

export interface EmployeeLeaderboardRow {
  employeeId: number;
  employeeName: string;
  totalPoints: number;
  pointItemsQty: number;
}

export interface ItemPointBreakdownRow {
  itemId: number;
  itemName: string;
  itemGroup: string | null;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
}

export interface PointItemInput {
  id: number;
  name: string;
  itemGroup: string | null;
}
export interface PointRuleInput {
  pattern: string;
  points: number;
  startDate?: Date | string | null;
}
export interface GroupDefaultInput {
  itemGroup: string;
  points: number;
}
export interface ExclusionInput {
  pattern: string;
}

export function createPointResolver(
  items: PointItemInput[],
  rules: PointRuleInput[],
  groupDefaults: GroupDefaultInput[],
  exclusions: ExclusionInput[]
) {
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const groupPointByGroup = new Map(groupDefaults.map((g) => [g.itemGroup, g.points]));
  const exclusionPatterns = exclusions.map((e) => e.pattern.toUpperCase());

  type RuleWithDate = { pattern: string; points: number; dateStr: string };
  const rulesByPattern = new Map<string, RuleWithDate[]>();
  for (const r of rules) {
    const pUpper = r.pattern.toUpperCase();
    const dateStr = r.startDate ? toDateStr(r.startDate) : "1970-01-01";
    const list = rulesByPattern.get(pUpper) ?? [];
    list.push({ pattern: r.pattern, points: r.points, dateStr });
    rulesByPattern.set(pUpper, list);
  }
  for (const list of rulesByPattern.values()) {
    list.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }

  const uniquePatternsDesc = [...rulesByPattern.keys()].sort((a, b) => b.length - a.length);
  const cache = new Map<string, number>();

  return function resolve(itemId: number, saleDate?: Date | string | null): number {
    const dateStr = saleDate ? toDateStr(saleDate) : toDateStr(new Date());
    const cacheKey = `${itemId}:${dateStr}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const item = itemMap.get(itemId);
    if (!item) {
      cache.set(cacheKey, 0);
      return 0;
    }

    const upperName = item.name.toUpperCase();
    if (exclusionPatterns.some((p) => upperName.includes(p))) {
      cache.set(cacheKey, 0);
      return 0;
    }

    for (const pattern of uniquePatternsDesc) {
      if (upperName.includes(pattern)) {
        const variants = rulesByPattern.get(pattern)!;
        const active = variants.find((v) => v.dateStr <= dateStr);
        if (active) {
          cache.set(cacheKey, active.points);
          return active.points;
        }
      }
    }

    if (item.itemGroup && groupPointByGroup.has(item.itemGroup)) {
      const pts = groupPointByGroup.get(item.itemGroup)!;
      cache.set(cacheKey, pts);
      return pts;
    }

    cache.set(cacheKey, 0);
    return 0;
  };
}

/** Pure resolution algorithm, split out from its Prisma fetches so it can be
 * unit-tested without a database. Priority: an ItemPointExclusion match
 * always wins (forces 0, no matter what) > an explicit ItemPoint pattern
 * match (longest/most-specific pattern wins, latest startDate <= asOfDate) > the item's
 * ItemGroupPointDefault fallback > 0. */
export function computeItemPoints(
  items: PointItemInput[],
  rules: PointRuleInput[],
  groupDefaults: GroupDefaultInput[],
  exclusions: ExclusionInput[],
  asOfDate?: Date | string
): Map<number, number> {
  const resolver = createPointResolver(items, rules, groupDefaults, exclusions);
  const result = new Map<number, number>();
  for (const item of items) {
    result.set(item.id, resolver(item.id, asOfDate));
  }
  return result;
}

export async function getItemPointResolver(itemIds: number[]) {
  const [items, rules, groupDefaults, exclusions] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, itemGroup: true },
    }),
    prisma.itemPoint.findMany({ orderBy: { startDate: "desc" } }),
    prisma.itemGroupPointDefault.findMany(),
    prisma.itemPointExclusion.findMany(),
  ]);
  return {
    items,
    resolver: createPointResolver(items, rules, groupDefaults, exclusions),
  };
}

/** Resolves point values only for the given itemIds — avoids loading all items. */
export async function resolveItemPointsForIds(
  itemIds: number[],
  asOfDate?: Date | string
): Promise<Map<number, number>> {
  const { resolver } = await getItemPointResolver(itemIds);
  const result = new Map<number, number>();
  for (const id of itemIds) {
    result.set(id, resolver(id, asOfDate));
  }
  return result;
}

export interface PointPeriodSetting {
  periodStartDay: number;
  pointTargetDaily: number;
  pointTargetWeekly: number;
  pointTargetMonthly: number;
  /** Rupiah value of 1 point — admin-only incentive column on the internal
   *  Poin Penjualan page, never sent to the public Papan Poin endpoint. */
  pointRupiahRate: number;
}

export async function getPointPeriodSetting(): Promise<PointPeriodSetting> {
  const setting = await prisma.pointSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, periodStartDay: 1, pointTargetDaily: 0, pointTargetWeekly: 0, pointTargetMonthly: 0, pointRupiahRate: 100 },
  });
  return {
    periodStartDay: setting.periodStartDay,
    pointTargetDaily: setting.pointTargetDaily,
    pointTargetWeekly: setting.pointTargetWeekly,
    pointTargetMonthly: setting.pointTargetMonthly,
    pointRupiahRate: setting.pointRupiahRate,
  };
}

export interface PointTargetUpdate {
  daily?: number;
  weekly?: number;
  monthly?: number;
  rupiahRate?: number;
}

export async function setPointPeriodSetting(periodStartDay: number, targets?: PointTargetUpdate): Promise<void> {
  await prisma.pointSettings.upsert({
    where: { id: 1 },
    update: {
      periodStartDay,
      ...(targets?.daily !== undefined ? { pointTargetDaily: targets.daily } : {}),
      ...(targets?.weekly !== undefined ? { pointTargetWeekly: targets.weekly } : {}),
      ...(targets?.monthly !== undefined ? { pointTargetMonthly: targets.monthly } : {}),
      ...(targets?.rupiahRate !== undefined ? { pointRupiahRate: targets.rupiahRate } : {}),
    },
    create: {
      id: 1,
      periodStartDay,
      pointTargetDaily: targets?.daily ?? 0,
      pointTargetWeekly: targets?.weekly ?? 0,
      pointTargetMonthly: targets?.monthly ?? 0,
      pointRupiahRate: targets?.rupiahRate ?? 100,
    },
  });
}

/** The period labeled "year-month" starts on `periodStartDay` of that month
 * and ends the day before `periodStartDay` of the next month — i.e. it's
 * named after the month it *starts* in, matching the "berjalan tanggal 29
 * sampai 28 bulan berikutnya" wording on the settings page. With the default
 * periodStartDay=1 this is just the calendar month; periodStartDay=29 gives
 * e.g. 29 Sep – 28 Oct for the period labeled September (month=9). */
export function computeMonthPeriod(
  year: number,
  month: number, // 1-12
  periodStartDay: number
): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, month - 1, periodStartDay));
  const to = new Date(Date.UTC(year, month, periodStartDay - 1));
  return { from, to };
}

/** The month-cycle period (see computeMonthPeriod) that contains today — e.g.
 *  periodStartDay=29 and today the 6th means the period actually running
 *  right now is still "last month" (29th – 28th), not the calendar month. */
export function computeCurrentMonthPeriod(periodStartDay: number): { from: Date; to: Date } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12
  if (now.getDate() < periodStartDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return computeMonthPeriod(year, month, periodStartDay);
}

/** Monday–Sunday week containing `dateStr` (YYYY-MM-DD), inclusive. */
export function computeWeekPeriod(dateStr: string): { from: Date; to: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0=Sunday..6=Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const from = new Date(date);
  from.setUTCDate(date.getUTCDate() + diffToMonday);
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  return { from, to };
}

// Category buckets shown on the public points dashboard, matched by
// case-insensitive substring against Item.name. Order matters — checked
// top to bottom, first match wins — since some keywords are substrings of
// others (e.g. "Car Charger" contains "Charger", so the more specific rule
// must come first). Informed by the default point rules in
// src/lib/defaults/itemPoints.ts.
const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  { category: "Car Holder/Charger", keywords: ["CAR HOLDER", "CAR CHARGER"] },
  { category: "TWS", keywords: ["TWS"] },
  { category: "Power Bank", keywords: ["POWER BANK", "POWERBANK"] },
  { category: "Speaker", keywords: ["SPEAKER"] },
  { category: "Handsfree", keywords: ["HANDSFREE", "HF "] },
  { category: "Kabel Data", keywords: ["KABEL"] },
  { category: "Charger", keywords: ["CHARGER", "BATOK"] },
];

export function classifyItemCategory(itemName: string): string {
  const upper = itemName.toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => upper.includes(kw))) return rule.category;
  }
  return "Lainnya";
}

export async function getLeaderboard(
  from: Date,
  to: Date,
  branch?: "BANDUNG" | "CIMAHI",
  category?: ReportCategory
): Promise<{ rows: EmployeeLeaderboardRow[]; from: string; to: string }> {
  await ensureDefaults();

  const [excludedIds, categoryGroups] = await Promise.all([
    getExcludedEmployeeIds(),
    category ? getItemGroupsForCategory(category) : Promise.resolve(undefined),
  ]);

  // Aggregate at DB level — group by item, employee, and tanggal
  const salesAgg = await prisma.sale.groupBy({
    by: ["itemId", "employeeId", "tanggal"],
    where: {
      tanggal: { gte: from, lte: to },
      ...(excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {}),
      ...(branch ? { outlet: { branch } } : {}),
      ...(categoryGroups ? { item: { itemGroup: { in: categoryGroups } } } : {}),
    },
    _sum: { qty: true },
  });

  const itemIds = [...new Set(salesAgg.map((s) => s.itemId))];
  const empIds = [...new Set(salesAgg.map((s) => s.employeeId))];

  const [{ resolver }, employees] = await Promise.all([
    getItemPointResolver(itemIds),
    prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, name: true },
    }),
  ]);
  const empNameById = new Map(employees.map((e) => [e.id, e.name]));

  const byEmployee = new Map<number, EmployeeLeaderboardRow>();
  for (const s of salesAgg) {
    const pointsPerUnit = resolver(s.itemId, s.tanggal);
    if (pointsPerUnit === 0) continue;
    const qty = s._sum.qty ?? 0;
    const earned = pointsPerUnit * qty;
    const existing = byEmployee.get(s.employeeId);
    if (existing) {
      existing.totalPoints += earned;
      existing.pointItemsQty += qty;
    } else {
      byEmployee.set(s.employeeId, {
        employeeId: s.employeeId,
        employeeName: empNameById.get(s.employeeId) ?? "—",
        totalPoints: earned,
        pointItemsQty: qty,
      });
    }
  }

  const rows = [...byEmployee.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  return { rows, from: from.toISOString(), to: to.toISOString() };
}

export interface LeaderboardExportRow extends EmployeeLeaderboardRow {
  items: ItemPointBreakdownRow[];
}

/** Leaderboard + every employee's point-item breakdown in a single pass — for
 *  the Excel export, so it doesn't fan out into one request per employee. */
export async function getLeaderboardExport(
  from: Date,
  to: Date,
  branch?: "BANDUNG" | "CIMAHI",
  category?: ReportCategory
): Promise<{ rows: LeaderboardExportRow[]; from: string; to: string }> {
  await ensureDefaults();

  const [excludedIds, categoryGroups] = await Promise.all([
    getExcludedEmployeeIds(),
    category ? getItemGroupsForCategory(category) : Promise.resolve(undefined),
  ]);

  const salesAgg = await prisma.sale.groupBy({
    by: ["itemId", "employeeId", "tanggal"],
    where: {
      tanggal: { gte: from, lte: to },
      ...(excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {}),
      ...(branch ? { outlet: { branch } } : {}),
      ...(categoryGroups ? { item: { itemGroup: { in: categoryGroups } } } : {}),
    },
    _sum: { qty: true },
  });

  const itemIds = [...new Set(salesAgg.map((s) => s.itemId))];
  const empIds = [...new Set(salesAgg.map((s) => s.employeeId))];

  const [{ items, resolver }, employees] = await Promise.all([
    getItemPointResolver(itemIds),
    prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } }),
  ]);
  const empNameById = new Map(employees.map((e) => [e.id, e.name]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const byEmployee = new Map<number, {
    row: EmployeeLeaderboardRow;
    itemsMap: Map<string, ItemPointBreakdownRow>;
  }>();

  for (const s of salesAgg) {
    const pointsPerUnit = resolver(s.itemId, s.tanggal);
    if (pointsPerUnit === 0) continue;
    const qty = s._sum.qty ?? 0;
    const earned = pointsPerUnit * qty;
    const item = itemById.get(s.itemId);
    const itemKey = `${s.itemId}:${pointsPerUnit}`;

    let empData = byEmployee.get(s.employeeId);
    if (!empData) {
      empData = {
        row: {
          employeeId: s.employeeId,
          employeeName: empNameById.get(s.employeeId) ?? "—",
          totalPoints: 0,
          pointItemsQty: 0,
        },
        itemsMap: new Map(),
      };
      byEmployee.set(s.employeeId, empData);
    }
    empData.row.totalPoints += earned;
    empData.row.pointItemsQty += qty;

    const existingLine = empData.itemsMap.get(itemKey);
    if (existingLine) {
      existingLine.qty += qty;
      existingLine.totalPoints += earned;
    } else {
      empData.itemsMap.set(itemKey, {
        itemId: s.itemId,
        itemName: item?.name ?? "Tidak diketahui",
        itemGroup: item?.itemGroup ?? null,
        qty,
        pointsPerUnit,
        totalPoints: earned,
      });
    }
  }

  const rows: LeaderboardExportRow[] = [...byEmployee.values()].map((d) => {
    const sortedItems = [...d.itemsMap.values()].sort((a, b) => b.totalPoints - a.totalPoints);
    return {
      ...d.row,
      items: sortedItems,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return { rows, from: from.toISOString(), to: to.toISOString() };
}

export async function getEmployeePointBreakdown(
  employeeId: number,
  from: Date,
  to: Date,
  outletId?: number,
  branch?: "BANDUNG" | "CIMAHI",
  category?: ReportCategory
): Promise<ItemPointBreakdownRow[]> {
  await ensureDefaults();

  const categoryGroups = category ? await getItemGroupsForCategory(category) : undefined;

  // Aggregate at DB level — group by itemId and tanggal
  const salesAgg = await prisma.sale.groupBy({
    by: ["itemId", "tanggal"],
    where: {
      employeeId,
      tanggal: { gte: from, lte: to },
      ...(outletId ? { outletId } : {}),
      ...(branch ? { outlet: { branch } } : {}),
      ...(categoryGroups ? { item: { itemGroup: { in: categoryGroups } } } : {}),
    },
    _sum: { qty: true },
  });

  const itemIds = [...new Set(salesAgg.map((s) => s.itemId))];

  const { items, resolver } = await getItemPointResolver(itemIds);
  const itemById = new Map(items.map((i) => [i.id, i]));

  const breakdownMap = new Map<string, ItemPointBreakdownRow>();
  for (const s of salesAgg) {
    const pointsPerUnit = resolver(s.itemId, s.tanggal);
    if (pointsPerUnit === 0) continue;
    const qty = s._sum.qty ?? 0;
    const item = itemById.get(s.itemId);
    const key = `${s.itemId}:${pointsPerUnit}`;
    const earned = pointsPerUnit * qty;

    const existing = breakdownMap.get(key);
    if (existing) {
      existing.qty += qty;
      existing.totalPoints += earned;
    } else {
      breakdownMap.set(key, {
        itemId: s.itemId,
        itemName: item?.name ?? "Tidak diketahui",
        itemGroup: item?.itemGroup ?? null,
        qty,
        pointsPerUnit,
        totalPoints: earned,
      });
    }
  }

  return [...breakdownMap.values()].sort((a, b) => b.totalPoints - a.totalPoints);
}

export interface CategoryPointRow {
  category: string;
  points: number;
  qty: number;
}

export interface PublicPointsRow {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  totalPoints: number;
  pointItemsQty: number;
  achievementPct: number;
  categoryBreakdown: CategoryPointRow[];
}

export interface PublicPointsDashboard {
  rows: PublicPointsRow[];
  from: string;
  to: string;
  pointTarget: number;
  outlets: { id: number; name: string }[];
}

/** Powers the public, no-login "Papan Poin Karyawan" dashboard. Unlike
 *  getLeaderboard (internal, network-wide only), this includes every active
 *  employee — even ones with 0 points this period — and can scope points to
 *  one outlet. An employee's displayed "outlet" is always their busiest one
 *  *within the resolved scope* for the period (stable, not affected by the
 *  outlet filter itself); when an outlet or branch filter is active, the
 *  roster itself narrows to employees who actually sold something in that
 *  scope this period, since a wallboard showing every other employee at 0
 *  would be noise. `category` scopes to one report category (Aksesoris /
 *  Petshop / SP-Voucher — see the internal /points split); omit to mix all
 *  three, the only behavior before that split existed. `branch` scopes to
 *  one cabang's outlets; omit for the pre-Cimahi-split, network-wide
 *  behavior. Employee itself carries no branch column (it's an outlet
 *  property), so branch scoping works the same way outlet scoping already
 *  did — via which outlets the employee actually sold at this period. */
export async function getPublicPointsDashboard(
  from: Date,
  to: Date,
  outletId: number | undefined,
  pointTarget: number,
  category?: ReportCategory,
  branch?: "BANDUNG" | "CIMAHI"
): Promise<PublicPointsDashboard> {
  await ensureDefaults();

  const [excludedIds, categoryGroups] = await Promise.all([
    getExcludedEmployeeIds(),
    category ? getItemGroupsForCategory(category) : Promise.resolve(undefined),
  ]);
  const excludeClause = excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {};
  const branchClause = branch ? { outlet: { branch } } : {};

  const [roster, salesAgg, outletAgg, outlets] = await Promise.all([
    prisma.employee.findMany({
      where: { isHidden: false, ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}) },
      select: { id: true, name: true },
    }),
    prisma.sale.groupBy({
      by: ["itemId", "employeeId", "tanggal"],
      where: {
        tanggal: { gte: from, lte: to },
        ...excludeClause,
        ...branchClause,
        ...(outletId ? { outletId } : {}),
        ...(categoryGroups ? { item: { itemGroup: { in: categoryGroups } } } : {}),
      },
      _sum: { qty: true },
    }),
    // Deliberately NOT filtered by outletId (branch still applies) — this is
    // what makes an employee's displayed outlet stable across different
    // outlet-board views within the same branch.
    prisma.sale.groupBy({
      by: ["employeeId", "outletId"],
      where: { tanggal: { gte: from, lte: to }, ...excludeClause, ...branchClause },
      _count: { _all: true },
    }),
    prisma.outlet.findMany({
      where: { isHidden: false, ...(branch ? { branch } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const itemIds = [...new Set(salesAgg.map((s) => s.itemId))];
  const [{ items, resolver }] = await Promise.all([
    getItemPointResolver(itemIds),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));

  // Per employee: outletId -> transaction count this period (unfiltered).
  const outletCountsByEmployee = new Map<number, Map<number, number>>();
  for (const row of outletAgg) {
    const counts = outletCountsByEmployee.get(row.employeeId) ?? new Map<number, number>();
    counts.set(row.outletId, row._count._all);
    outletCountsByEmployee.set(row.employeeId, counts);
  }
  function homeOutletName(employeeId: number): string | null {
    const counts = outletCountsByEmployee.get(employeeId);
    if (!counts || counts.size === 0) return null;
    let bestId: number | null = null;
    let bestCount = -1;
    for (const [oId, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestId = oId;
      }
    }
    return bestId !== null ? (outletNameById.get(bestId) ?? null) : null;
  }

  // Points + category aggregation per employee.
  const statsByEmployee = new Map<
    number,
    { totalPoints: number; pointItemsQty: number; categories: Map<string, CategoryPointRow> }
  >();
  for (const s of salesAgg) {
    const pointsPerUnit = resolver(s.itemId, s.tanggal);
    if (pointsPerUnit === 0) continue;
    const qty = s._sum.qty ?? 0;
    const earned = pointsPerUnit * qty;
    const category = classifyItemCategory(itemById.get(s.itemId)?.name ?? "");

    let stat = statsByEmployee.get(s.employeeId);
    if (!stat) {
      stat = { totalPoints: 0, pointItemsQty: 0, categories: new Map() };
      statsByEmployee.set(s.employeeId, stat);
    }
    stat.totalPoints += earned;
    stat.pointItemsQty += qty;
    const catRow = stat.categories.get(category) ?? { category, points: 0, qty: 0 };
    catRow.points += earned;
    catRow.qty += qty;
    stat.categories.set(category, catRow);
  }

  // When viewing one outlet's board or a branch-specific board, only
  // show employees who actually transacted there this period — otherwise
  // employees from other branches/outlets would clutter that wallboard sitting at 0.
  const relevantRoster = outletId
    ? roster.filter((emp) => (outletCountsByEmployee.get(emp.id)?.get(outletId) ?? 0) > 0)
    : branch
    ? roster.filter((emp) => (outletCountsByEmployee.get(emp.id)?.size ?? 0) > 0)
    : roster;

  const rows: PublicPointsRow[] = relevantRoster.map((emp) => {
    const stat = statsByEmployee.get(emp.id);
    const totalPoints = stat?.totalPoints ?? 0;
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      outlet: homeOutletName(emp.id),
      totalPoints,
      pointItemsQty: stat?.pointItemsQty ?? 0,
      achievementPct: pointTarget > 0 ? (totalPoints / pointTarget) * 100 : 0,
      categoryBreakdown: stat ? [...stat.categories.values()].sort((a, b) => b.points - a.points) : [],
    };
  });
  rows.sort((a, b) => b.totalPoints - a.totalPoints);

  return { rows, from: from.toISOString(), to: to.toISOString(), pointTarget, outlets };
}
