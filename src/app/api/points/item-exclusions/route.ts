import { NextResponse } from "next/server";
import { addItemPointExclusion, listItemPointExclusions } from "@/lib/queries/points";
import { itemPointExclusionSchema } from "@/lib/schemas/points";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const rows = await listItemPointExclusions();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, itemPointExclusionSchema);
  if ("error" in parsed) return parsed.error;
  const { pattern } = parsed.data;

  const row = await addItemPointExclusion(pattern);
  return NextResponse.json(row, { status: 201 });
}
