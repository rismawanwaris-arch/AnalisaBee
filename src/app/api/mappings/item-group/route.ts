import { NextResponse } from "next/server";
import { createItemGroupMapping, listItemGroupMappings } from "@/lib/queries/mappings";
import { itemGroupMappingSchema } from "@/lib/schemas/mappings";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const mappings = await listItemGroupMappings();
  return NextResponse.json(mappings);
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, itemGroupMappingSchema);
  if ("error" in parsed) return parsed.error;
  const { itemGroup, category } = parsed.data;

  const created = await createItemGroupMapping(itemGroup, category);
  return NextResponse.json(created, { status: 201 });
}
