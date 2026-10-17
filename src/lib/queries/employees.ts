import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { EXCLUDE_HIDDEN_ITEMS } from "@/lib/queries/_hiddenItems";

export interface EmployeeSummaryFilters {
  from?: Date;
  to?: Date;
  itemId?: number;
  outletId?: number;
  employeeId?: number;
  subtotalMin?: number;
  subtotalMax?: number;
  itemGroup?: string;
  brand?: string;
  itemKeyword?: string;
}

export async function getEmployeeSummary(filters: EmployeeSummaryFilters = {}) {
  const where: Prisma.SaleWhereInput = {
    employee: { isHidden: false },
    outlet: { isHidden: false },
    item: {
      isHidden: false,
      ...(filters.itemGroup ? { itemGroup: filters.itemGroup } : {}),
      ...(filters.brand ? { brand: filters.brand } : {}),
      ...(filters.itemKeyword ? { name: { contains: filters.itemKeyword, mode: "insensitive" } } : {}),
    },
  };

  if (filters.from || filters.to) {
    where.tanggal = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.outletId) where.outletId = filters.outletId;
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const [sums, employees] = await Promise.all([
    prisma.sale.groupBy({
      by: ["employeeId"],
      where,
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
    prisma.employee.findMany({ where: { isHidden: false }, select: { id: true, name: true } }),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e.name]));

  let rows = sums
    .filter((s) => employeeById.has(s.employeeId))
    .map((s) => ({
      id: s.employeeId,
      name: employeeById.get(s.employeeId) ?? "—",
      qty: s._sum.qty ?? 0,
      subtotal: Number(s._sum.subtotal ?? 0),
      labaRugi: Number(s._sum.labaRugi ?? 0),
      transactionCount: s._count._all,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  if (filters.subtotalMin !== undefined) rows = rows.filter((r) => r.subtotal >= filters.subtotalMin!);
  if (filters.subtotalMax !== undefined) rows = rows.filter((r) => r.subtotal <= filters.subtotalMax!);

  return rows;
}

export async function getEmployeeList(includeHidden = false) {
  const [employees, sums] = await Promise.all([
    prisma.employee.findMany({
      where: includeHidden ? undefined : { isHidden: false },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["employeeId"],
      where: EXCLUDE_HIDDEN_ITEMS,
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
  ]);

  const sumByEmployee = new Map(sums.map((s) => [s.employeeId, s]));

  return employees
    .map((e) => {
      const s = sumByEmployee.get(e.id);
      return {
        id: e.id,
        name: e.name,
        isHidden: e.isHidden,
        qty: s?._sum.qty ?? 0,
        subtotal: Number(s?._sum.subtotal ?? 0),
        labaRugi: Number(s?._sum.labaRugi ?? 0),
        transactionCount: s?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
}

export async function getEmployeeDetail(employeeId: number, filters: EmployeeSummaryFilters = {}) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const saleWhere: Prisma.SaleWhereInput = {
    employeeId,
    outlet: { isHidden: false },
    item: {
      isHidden: false,
      ...(filters.itemGroup ? { itemGroup: filters.itemGroup } : {}),
      ...(filters.brand ? { brand: filters.brand } : {}),
      ...(filters.itemKeyword ? { name: { contains: filters.itemKeyword, mode: "insensitive" } } : {}),
    },
  };

  if (filters.from || filters.to) {
    saleWhere.tanggal = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.itemId) saleWhere.itemId = filters.itemId;
  if (filters.outletId) saleWhere.outletId = filters.outletId;

  const [totals, byOutlet, byDate] = await Promise.all([
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ["outletId"],
      where: saleWhere,
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 20,
    }),
    prisma.sale.groupBy({
      by: ["tanggal"],
      where: saleWhere,
      _sum: { qty: true, subtotal: true },
      orderBy: { tanggal: "asc" },
    }),
  ]);

  const outlets = await prisma.outlet.findMany({ where: { id: { in: byOutlet.map((o) => o.outletId) } } });
  const outletById = new Map(outlets.map((o) => [o.id, o]));

  return {
    employee: { id: employee.id, name: employee.name },
    totals: {
      qty: totals._sum.qty ?? 0,
      subtotal: Number(totals._sum.subtotal ?? 0),
      labaRugi: Number(totals._sum.labaRugi ?? 0),
      transactionCount: totals._count._all,
    },
    byOutlet: byOutlet.map((g) => ({
      outletId: g.outletId,
      outletName: outletById.get(g.outletId)?.name ?? "Tidak diketahui",
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
    })),
    trend: byDate.map((g) => ({
      tanggal: g.tanggal.toISOString(),
      qty: g._sum.qty ?? 0,
      subtotal: Number(g._sum.subtotal ?? 0),
    })),
  };
}
