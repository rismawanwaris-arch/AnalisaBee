import { prisma } from "@/lib/prisma";

export interface SystemStatus {
  outletCount: number;
  saleRowCount: number;
  lastImportAt: string | null;
  lastImportFilename: string | null;
}

/** Powers the sidebar health strip. Deliberately cheap — two counts and one
 * row — since it renders on every page. */
export async function getSystemStatus(): Promise<SystemStatus> {
  const [outletCount, saleRowCount, lastImport] = await Promise.all([
    prisma.outlet.count(),
    prisma.sale.count(),
    prisma.importBatch.findFirst({
      where: { status: "DONE" },
      orderBy: { uploadedAt: "desc" },
      select: { uploadedAt: true, filename: true },
    }),
  ]);

  return {
    outletCount,
    saleRowCount,
    lastImportAt: lastImport?.uploadedAt.toISOString() ?? null,
    lastImportFilename: lastImport?.filename ?? null,
  };
}
