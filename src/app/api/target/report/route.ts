import { NextResponse } from "next/server";
import { getDailyTargetReport, getTargetAmounts } from "@/lib/queries/targetReport";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Parameter date wajib diisi (YYYY-MM-DD)." }, { status: 400 });
  }

  const [report, targets] = await Promise.all([getDailyTargetReport(date), getTargetAmounts()]);

  return NextResponse.json({
    date: dateParam,
    rows: report.rows,
    unmappedItemGroups: report.unmappedItemGroups,
    targets,
  });
}
