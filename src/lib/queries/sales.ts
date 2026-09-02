import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface SalesFilters {
  from?: Date;
  to?: Date;
  itemId?: number;
  outletId?: number;
  employeeId?: number;
  noTransaksi?: string;
  jamFrom?: string;
  jamTo?: string;
  qtyMin?: number;
  qtyMax?: number;
  subtotalMin?: number;
  subtotalMax?: number;
  labaRugiMin?: number;
  labaRugiMax?: number;
}

export function buildSalesWhere(filters: SalesFilters): Prisma.SaleWhereInput {
  const {
    from,
    to,
    itemId,
    outletId,
    employeeId,
    noTransaksi,
    jamFrom,
    jamTo,
    qtyMin,
    qtyMax,
    subtotalMin,
    subtotalMax,
    labaRugiMin,
    labaRugiMax,
  } = filters;
  return {
    ...(itemId ? { itemId } : {}),
    ...(outletId ? { outletId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(noTransaksi ? { noTransaksi: { contains: noTransaksi, mode: "insensitive" } } : {}),
    ...(from || to
      ? {
          tanggal: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(jamFrom || jamTo
      ? {
          jamBuat: {
            ...(jamFrom ? { gte: jamFrom } : {}),
            ...(jamTo ? { lte: jamTo } : {}),
          },
        }
      : {}),
    ...(qtyMin !== undefined || qtyMax !== undefined
      ? {
          qty: {
            ...(qtyMin !== undefined ? { gte: qtyMin } : {}),
            ...(qtyMax !== undefined ? { lte: qtyMax } : {}),
          },
        }
      : {}),
    ...(subtotalMin !== undefined || subtotalMax !== undefined
      ? {
          subtotal: {
            ...(subtotalMin !== undefined ? { gte: subtotalMin } : {}),
            ...(subtotalMax !== undefined ? { lte: subtotalMax } : {}),
          },
        }
      : {}),
    ...(labaRugiMin !== undefined || labaRugiMax !== undefined
      ? {
          labaRugi: {
            ...(labaRugiMin !== undefined ? { gte: labaRugiMin } : {}),
            ...(labaRugiMax !== undefined ? { lte: labaRugiMax } : {}),
          },
        }
      : {}),
  };
}

const LIST_INCLUDE = {
  outlet: { select: { name: true } },
  item: { select: { code: true, name: true } },
  employee: { select: { name: true } },
} satisfies Prisma.SaleInclude;

export async function getSalesList(
  filters: SalesFilters,
  page: number,
  pageSize: number
) {
  const where = buildSalesWhere(filters);

  const [rows, total, totals] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: [{ tanggal: "desc" }, { noTransaksi: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({
      where,
      _sum: { qty: true, subtotal: true, labaRugi: true },
    }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      noTransaksi: r.noTransaksi,
      tanggal: r.tanggal.toISOString(),
      jamBuat: r.jamBuat,
      outletName: r.outlet.name,
      itemCode: r.item.code,
      itemName: r.item.name,
      qty: r.qty,
      unit: r.unit,
      hargaJual: Number(r.hargaJual),
      subtotal: Number(r.subtotal),
      labaRugi: Number(r.labaRugi),
      employeeName: r.employee.name,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totals: {
      qty: totals._sum.qty ?? 0,
      subtotal: Number(totals._sum.subtotal ?? 0),
      labaRugi: Number(totals._sum.labaRugi ?? 0),
    },
  };
}

const EXPORT_ROW_CAP = 50_000;

export async function getSalesForExport(filters: SalesFilters) {
  const where = buildSalesWhere(filters);
  const rows = await prisma.sale.findMany({
    where,
    include: LIST_INCLUDE,
    orderBy: [{ tanggal: "asc" }, { noTransaksi: "asc" }],
    take: EXPORT_ROW_CAP,
  });
  return rows.map((r) => ({
    noTransaksi: r.noTransaksi,
    tanggal: r.tanggal.toISOString(),
    jamBuat: r.jamBuat,
    outletName: r.outlet.name,
    itemCode: r.item.code,
    itemName: r.item.name,
    qty: r.qty,
    unit: r.unit,
    hargaJual: Number(r.hargaJual),
    subtotal: Number(r.subtotal),
    labaRugi: Number(r.labaRugi),
    employeeName: r.employee.name,
  }));
}
