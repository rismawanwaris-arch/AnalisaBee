import { NextResponse } from "next/server";
import { excludeEmployee, listExcludedEmployees } from "@/lib/queries/points";
import { excludeEmployeeSchema } from "@/lib/schemas/points";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const rows = await listExcludedEmployees();
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      reason: r.reason,
    }))
  );
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, excludeEmployeeSchema);
  if ("error" in parsed) return parsed.error;
  const { employeeId, reason } = parsed.data;

  try {
    const row = await excludeEmployee(employeeId, reason);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
