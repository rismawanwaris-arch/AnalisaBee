import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/queries/dashboard";

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));
  const outletIdRaw = searchParams.get("outletId");
  const outletId = outletIdRaw ? Number(outletIdRaw) : undefined;

  const summary = await getDashboardSummary({
    from,
    to,
    outletId: outletId && Number.isInteger(outletId) ? outletId : undefined,
  });
  return NextResponse.json(summary);
}
