import { NextResponse } from "next/server";
import { listGroupPointDefaults, upsertGroupPointDefault } from "@/lib/queries/points";
import { groupPointDefaultSchema } from "@/lib/schemas/points";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const rules = await listGroupPointDefaults();
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, groupPointDefaultSchema);
  if ("error" in parsed) return parsed.error;
  const { itemGroup, points } = parsed.data;

  const rule = await upsertGroupPointDefault(itemGroup, points);
  return NextResponse.json(rule, { status: 201 });
}
