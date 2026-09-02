import { NextResponse } from "next/server";
import { deleteItemGroupMapping } from "@/lib/queries/mappings";
import { invalidIdResponse, parseIntId } from "@/lib/api/validate";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/mappings/item-group/[id]">) {
  const { id } = await ctx.params;
  const mappingId = parseIntId(id);
  if (mappingId === null) return invalidIdResponse();
  await deleteItemGroupMapping(mappingId);
  return NextResponse.json({ success: true });
}
