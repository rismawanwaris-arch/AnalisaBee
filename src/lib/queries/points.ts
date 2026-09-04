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

async function getExcludedEmployeeIds(): Promise<number[]> {
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
async function resolveItemPointsForIds(itemIds: number[]): Promise<Map<number, number>> {
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

export async function getPointPeriodSetting(): Promise<{ periodStartDay: number }> {
  const setting = await prisma.pointSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, periodStartDay: 1 },
  });
  return { periodStartDay: setting.periodStartDay };
}

export async function setPointPeriodSetting(periodStartDay: number): Promise<void> {
  await prisma.pointSettings.upsert({
    where: { id: 1 },
    update: { periodStartDay },
    create: { id: 1, periodStartDay },
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
