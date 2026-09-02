import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidIdResponse, parseIntId } from "@/lib/api/validate";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/imports/[id]">) {
  const { id } = await ctx.params;
  const importId = parseIntId(id);
  if (importId === null) return invalidIdResponse();

  const existing = await prisma.importBatch.findUnique({ where: { id: importId } });
  if (!existing) {
    return NextResponse.json({ error: "Import tidak ditemukan." }, { status: 404 });
  }

  // Sale rows cascade-delete with the batch (onDelete: Cascade in schema).
  await prisma.importBatch.delete({ where: { id: importId } });

  return NextResponse.json({ success: true, filename: existing.filename });
}
