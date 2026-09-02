import { NextResponse } from "next/server";
import { getItemDetail } from "@/lib/queries/items";

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Item id tidak valid." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));

  const detail = await getItemDetail(itemId, { from, to });
  if (!detail) {
    return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
