import { prisma } from "@/lib/prisma";

export async function getEmployeeList(includeHidden = false) {
  const [employees, sums] = await Promise.all([
    prisma.employee.findMany({
      where: includeHidden ? undefined : { isHidden: false },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["employeeId"],
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

export async function getEmployeeDetail(employeeId: number) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const [totals, byOutlet, byDate] = await Promise.all([
    prisma.sale.aggregate({
      where: { employeeId },
      _sum: { qty: true, subtotal: true, labaRugi: true },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ["outletId"],
      where: { employeeId },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 20,
    }),
    prisma.sale.groupBy({
      by: ["tanggal"],
      where: { employeeId },
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
