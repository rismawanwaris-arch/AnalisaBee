import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";

export async function listItemPointRules() {
  await ensureDefaults();
  return prisma.itemPoint.findMany({ orderBy: { pattern: "asc" } });
}

export async function upsertItemPointRule(pattern: string, points: number) {
  return prisma.itemPoint.upsert({
    where: { pattern },
    update: { points, isDefault: false },
    create: { pattern, points, isDefault: false },
  });
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

interface PointItemInput {
  id: number;
  name: string;
  itemGroup: string | null;
}
interface PointRuleInput {
  pattern: string;
  points: number;
}
interface GroupDefaultInput {
  itemGroup: string;
  points: number;
}
interface ExclusionInput {
  pattern: string;
}

/** Pure resolution algorithm, split out from its Prisma fetches so it can be
 * unit-tested without a database. Priority: an ItemPointExclusion match
 * always wins (forces 0, no matter what) > an explicit ItemPoint pattern
 * match (longest/most-specific pattern wins) > the item's
 * ItemGroupPointDefault fallback > 0. */
export function computeItemPoints(
  items: PointItemInput[],
  rules: PointRuleInput[],
  groupDefaults: GroupDefaultInput[],
  exclusions: ExclusionInput[]
): Map<number, number> {
  const sortedRules = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  const groupPointByGroup = new Map(groupDefaults.map((g) => [g.itemGroup, g.points]));
  const exclusionPatterns = exclusions.map((e) => e.pattern.toUpperCase());

  const result = new Map<number, number>();
  for (const item of items) {
    const upperName = item.name.toUpperCase();
    if (exclusionPatterns.some((p) => upperName.includes(p))) {
      result.set(item.id, 0);
      continue;
    }
    const matchedRule = sortedRules.find((r) => upperName.includes(r.pattern.toUpperCase()));
    if (matchedRule) {
      result.set(item.id, matchedRule.points);
    } else if (item.itemGroup && groupPointByGroup.has(item.itemGroup)) {
      result.set(item.id, groupPointByGroup.get(item.itemGroup)!);
    } else {
      result.set(item.id, 0);
    }
  }
  return result;
}

/** Resolves point values only for the given itemIds — avoids loading all items. */
export async function resolveItemPointsForIds(itemIds: number[]): Promise<Map<number, number>> {
  const [items, rules, groupDefaults, exclusions] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, itemGroup: true },
    }),
    prisma.itemPoint.findMany(),
    prisma.itemGroupPointDefault.findMany(),
    prisma.itemPointExclusion.findMany(),
  ]);
  return computeItemPoints(items, rules, groupDefaults, exclusions);
}

export async function getPointPeriodSetting(): Promise<{ periodStartDay: number; pointTarget: number }> {
  const setting = await prisma.pointSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, periodStartDay: 1, pointTarget: 0 },
  });
  return { periodStartDay: setting.periodStartDay, pointTarget: setting.pointTarget };
}

export async function setPointPeriodSetting(periodStartDay: number, pointTarget?: number): Promise<void> {
  await prisma.pointSettings.upsert({
    where: { id: 1 },
    update: { periodStartDay, ...(pointTarget !== undefined ? { pointTarget } : {}) },
    create: { id: 1, periodStartDay, pointTarget: pointTarget ?? 0 },
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
  to: Date
): Promise<{ rows: EmployeeLeaderboardRow[]; from: string; to: string }> {
  await ensureDefaults();

  const excludedIds = await getExcludedEmployeeIds();
  const excludedSet = new Set(excludedIds);

  // Aggregate at DB level — avoids pulling every sale row into memory
  const salesAgg = await prisma.sale.groupBy({
    by: ["itemId", "employeeId"],
    where: {
      tanggal: { gte: from, lte: to },
      ...(excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {}),
    },
    _sum: { qty: true },
  });

  const itemIds = [...new Set(salesAgg.map((s) => s.itemId))];
  const empIds = [...new Set(salesAgg.map((s) => s.employeeId))];

  const [pointsByItem, employees] = await Promise.all([
    resolveItemPointsForIds(itemIds),
    prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, name: true },
    }),
  ]);
  const empNameById = new Map(employees.map((e) => [e.id, e.name]));

  const byEmployee = new Map<number, EmployeeLeaderboardRow>();
  for (const s of salesAgg) {
    const pointsPerUnit = pointsByItem.get(s.itemId) ?? 0;
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

export async function getEmployeePointBreakdown(
  employeeId: number,
  from: Date,
  to: Date
): Promise<ItemPointBreakdownRow[]> {
  await ensureDefaults();

  // Aggregate at DB level — group by item, not individual sale rows
  const salesAgg = await prisma.sale.groupBy({
    by: ["itemId"],
    where: { employeeId, tanggal: { gte: from, lte: to } },
    _sum: { qty: true },
  });

  const itemIds = salesAgg.map((s) => s.itemId);

  const [pointsByItem, items] = await Promise.all([
    resolveItemPointsForIds(itemIds),
    prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, itemGroup: true },
    }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));

  return salesAgg
    .flatMap((s) => {
      const pointsPerUnit = pointsByItem.get(s.itemId) ?? 0;
      if (pointsPerUnit === 0) return [];
      const qty = s._sum.qty ?? 0;
      const item = itemById.get(s.itemId);
      return [{
        itemId: s.itemId,
        itemName: item?.name ?? "Tidak diketahui",
        itemGroup: item?.itemGroup ?? null,
        qty,
        pointsPerUnit,
        totalPoints: pointsPerUnit * qty,
      }] satisfies ItemPointBreakdownRow[];
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
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
 *  network-wide for the period (stable, not affected by the outlet filter);
 *  when an outlet filter is active, the roster itself narrows to employees
 *  who actually sold something there in this period, since a wallboard for
 *  one outlet showing every network-wide employee at 0 would be noise. */
export async function getPublicPointsDashboard(
  from: Date,
  to: Date,
  outletId?: number
): Promise<PublicPointsDashboard> {
  await ensureDefaults();

  const excludedIds = await getExcludedEmployeeIds();
  const excludeClause = excludedIds.length > 0 ? { employeeId: { notIn: excludedIds } } : {};

  const [roster, salesAgg, outletAgg, outlets, { pointTarget }] = await Promise.all([
    prisma.employee.findMany({
      where: { isHidden: false, ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}) },
      select: { id: true, name: true },
    }),
    prisma.sale.groupBy({
      by: ["itemId", "employeeId"],
      where: { tanggal: { gte: from, lte: to }, ...excludeClause, ...(outletId ? { outletId } : {}) },
      _sum: { qty: true },
    }),
    // Deliberately NOT filtered by outletId — this is what makes an
    // employee's displayed outlet stable across different outlet-board views.
    prisma.sale.groupBy({
      by: ["employeeId", "outletId"],
      where: { tanggal: { gte: from, lte: to }, ...excludeClause },
      _count: { _all: true },
    }),
    prisma.outlet.findMany({ where: { isHidden: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getPointPeriodSetting(),
  ]);

  const itemIds = [...new Set(salesAgg.map((s) => s.itemId))];
  const [pointsByItem, items] = await Promise.all([
    resolveItemPointsForIds(itemIds),
    prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } }),
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
    const pointsPerUnit = pointsByItem.get(s.itemId) ?? 0;
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

  // When viewing one outlet's board, only show employees who actually
  // transacted there this period — otherwise every network-wide employee
  // would clutter that outlet's wallboard sitting at 0.
  const relevantRoster = outletId
    ? roster.filter((emp) => (outletCountsByEmployee.get(emp.id)?.get(outletId) ?? 0) > 0)
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
