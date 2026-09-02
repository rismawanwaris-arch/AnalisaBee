import { NextResponse } from "next/server";
import { deleteOutletAlias } from "@/lib/queries/mappings";
import { invalidIdResponse, parseIntId } from "@/lib/api/validate";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/mappings/outlet-alias/[id]">) {
  const { id } = await ctx.params;
  const aliasId = parseIntId(id);
  if (aliasId === null) return invalidIdResponse();
  await deleteOutletAlias(aliasId);
  return NextResponse.json({ success: true });
}
