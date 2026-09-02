import { NextResponse } from "next/server";
import { searchItems } from "@/lib/queries/items";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Number(searchParams.get("limit")) || 20;

  const items = await searchItems(q, limit);

  return NextResponse.json(
    items.map((i) => ({ id: i.id, code: i.code, name: i.name, itemGroup: i.itemGroup }))
  );
}
