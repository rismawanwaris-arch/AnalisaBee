import { NextResponse } from "next/server";
import { includeEmployee } from "@/lib/queries/points";
import { invalidIdResponse, parseIntId } from "@/lib/api/validate";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/points/excluded-employees/[id]">
) {
  const { id } = await ctx.params;
  const exclusionId = parseIntId(id);
  if (exclusionId === null) return invalidIdResponse();
  await includeEmployee(exclusionId);
  return NextResponse.json({ success: true });
}
