import { NextResponse } from "next/server";
import { listItemPointRules, upsertItemPointRule } from "@/lib/queries/points";
import { itemPointRuleSchema } from "@/lib/schemas/points";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const rules = await listItemPointRules();
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, itemPointRuleSchema);
  if ("error" in parsed) return parsed.error;
  const { pattern, points } = parsed.data;

  try {
    const rule = await upsertItemPointRule(pattern, points);
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
