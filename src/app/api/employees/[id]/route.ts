import { NextResponse } from "next/server";
import { getEmployeeDetail } from "@/lib/queries/employees";

export async function GET(_request: Request, ctx: RouteContext<"/api/employees/[id]">) {
  const { id } = await ctx.params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: "Employee id tidak valid." }, { status: 400 });
  }

  const detail = await getEmployeeDetail(employeeId);
  if (!detail) {
    return NextResponse.json({ error: "Pegawai tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
