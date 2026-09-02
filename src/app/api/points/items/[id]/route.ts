import { NextResponse } from "next/server";
import { deleteItemPointRule } from "@/lib/queries/points";
import { invalidIdResponse, parseIntId } from "@/lib/api/validate";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/points/items/[id]">) {
  const { id } = await ctx.params;
  const ruleId = parseIntId(id);
  if (ruleId === null) return invalidIdResponse();
  await deleteItemPointRule(ruleId);
  return NextResponse.json({ success: true });
}
