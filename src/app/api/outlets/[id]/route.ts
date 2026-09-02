import { NextResponse } from "next/server";
import { getOutletDetail } from "@/lib/queries/outlets";

export async function GET(_request: Request, ctx: RouteContext<"/api/outlets/[id]">) {
  const { id } = await ctx.params;
  const outletId = Number(id);
  if (!Number.isInteger(outletId)) {
    return NextResponse.json({ error: "Outlet id tidak valid." }, { status: 400 });
  }

  const detail = await getOutletDetail(outletId);
  if (!detail) {
    return NextResponse.json({ error: "Outlet tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
