import { NextResponse } from "next/server";
import {
  computeMonthPeriod,
  getEmployeePointBreakdown,
  getPointPeriodSetting,
} from "@/lib/queries/points";

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: Request, ctx: RouteContext<"/api/points/employee/[id]">) {
  const { id } = await ctx.params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: "Employee id tidak valid." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = parseDateParam(searchParams.get("from"));
  const toParam = parseDateParam(searchParams.get("to"));

  let from: Date;
  let to: Date;

  if (fromParam && toParam) {
    from = fromParam;
    to = toParam;
  } else {
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Sertakan from & to, atau year & month yang valid." },
        { status: 400 }
      );
    }
    const { periodStartDay } = await getPointPeriodSetting();
    ({ from, to } = computeMonthPeriod(year, month, periodStartDay));
  }

  const rows = await getEmployeePointBreakdown(employeeId, from, to);
  return NextResponse.json(rows);
}
