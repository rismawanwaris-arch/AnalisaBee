import { NextResponse } from "next/server";
import { getOutletList } from "@/lib/queries/outlets";

export async function GET() {
  const result = await getOutletList();
  return NextResponse.json(result);
}
