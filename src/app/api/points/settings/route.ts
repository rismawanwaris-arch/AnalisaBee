import { NextResponse } from "next/server";
import { getPointPeriodSetting, setPointPeriodSetting } from "@/lib/queries/points";
import { periodSettingSchema } from "@/lib/schemas/points";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const setting = await getPointPeriodSetting();
  return NextResponse.json(setting);
}

export async function PUT(request: Request) {
  const parsed = await parseJsonBody(request, periodSettingSchema);
  if ("error" in parsed) return parsed.error;
  const { periodStartDay } = parsed.data;

  await setPointPeriodSetting(periodStartDay);
  return NextResponse.json({ periodStartDay });
}
