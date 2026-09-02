import { NextResponse } from "next/server";
import { getHourlyAnalytics, type Granularity } from "@/lib/queries/hourly";

const VALID_GRANULARITY: Granularity[] = ["EXACT", "15MIN", "30MIN", "1HOUR"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const date = dateStr ? new Date(dateStr) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Parameter date wajib diisi." }, { status: 400 });
  }

  const outletIdRaw = searchParams.get("outletId");
  const outletId = outletIdRaw ? Number(outletIdRaw) : undefined;
  const granularityRaw = searchParams.get("granularity") ?? "EXACT";
  const granularity = VALID_GRANULARITY.includes(granularityRaw as Granularity)
    ? (granularityRaw as Granularity)
    : "EXACT";

  const result = await getHourlyAnalytics(
    date,
    outletId && Number.isInteger(outletId) ? outletId : undefined,
    granularity
  );
  return NextResponse.json(result);
}
