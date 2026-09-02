import { NextResponse } from "next/server";
import { getSalesList } from "@/lib/queries/sales";
import { parseSalesFilterParams } from "@/lib/parseSalesFilterParams";

function parseIntParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseSalesFilterParams(searchParams);
  const page = Math.max(1, parseIntParam(searchParams.get("page")) ?? 1);
  const pageSize = Math.min(200, Math.max(10, parseIntParam(searchParams.get("pageSize")) ?? 50));

  const result = await getSalesList(filters, page, pageSize);
  return NextResponse.json(result);
}
