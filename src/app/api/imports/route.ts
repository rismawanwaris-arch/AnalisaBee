import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const imports = await prisma.importBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    imports.map((b) => ({
      id: b.id,
      filename: b.filename,
      uploadedAt: b.uploadedAt,
      status: b.status,
      rowCount: b.rowCount,
      insertedCount: b.insertedCount,
      duplicateCount: b.duplicateCount,
      errorRowCount: b.errorRowCount,
      errorMessage: b.errorMessage,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
    }))
  );
}
