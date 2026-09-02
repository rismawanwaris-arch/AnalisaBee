import { NextResponse } from "next/server";
import { getEmployeeList } from "@/lib/queries/employees";

export async function GET() {
  const result = await getEmployeeList();
  return NextResponse.json(result);
}
