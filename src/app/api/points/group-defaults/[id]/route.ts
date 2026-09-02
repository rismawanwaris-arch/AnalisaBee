import { NextResponse } from "next/server";
import { deleteGroupPointDefault } from "@/lib/queries/points";
import { invalidIdResponse, parseIntId } from "@/lib/api/validate";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/points/group-defaults/[id]">
) {
  const { id } = await ctx.params;
  const ruleId = parseIntId(id);
  if (ruleId === null) return invalidIdResponse();
  await deleteGroupPointDefault(ruleId);
  return NextResponse.json({ success: true });
}
