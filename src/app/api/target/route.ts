import { NextResponse } from "next/server";
import { getTargetAmounts, setTargetAmount } from "@/lib/queries/targetReport";
import { targetBatchSchema } from "@/lib/schemas/target";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const targets = await getTargetAmounts();
  return NextResponse.json(targets);
}

export async function PUT(request: Request) {
  const parsed = await parseJsonBody(request, targetBatchSchema);
  if ("error" in parsed) return parsed.error;
  const entries = parsed.data;

  await Promise.all(entries.map((e) => setTargetAmount(e.scope, e.category, e.amount)));

  const targets = await getTargetAmounts();
  return NextResponse.json(targets);
}
