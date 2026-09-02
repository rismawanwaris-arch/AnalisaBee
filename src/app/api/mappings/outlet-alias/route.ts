import { NextResponse } from "next/server";
import { createOutletAlias, listOutletAliases } from "@/lib/queries/mappings";
import { outletAliasSchema } from "@/lib/schemas/mappings";
import { parseJsonBody } from "@/lib/api/validate";

export async function GET() {
  const aliases = await listOutletAliases();
  return NextResponse.json(
    aliases.map((a) => ({
      id: a.id,
      alias: a.alias,
      outletId: a.outletId,
      outletName: a.outlet.name,
      isDefault: a.isDefault,
    }))
  );
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, outletAliasSchema);
  if ("error" in parsed) return parsed.error;
  const { alias, outletId } = parsed.data;

  try {
    const created = await createOutletAlias(alias, outletId);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan mapping.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
