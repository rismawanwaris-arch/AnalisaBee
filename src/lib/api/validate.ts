import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Parses and validates a JSON request body against a Zod schema. Returns
 * either the typed, validated data or a ready-to-return 400 NextResponse
 * with the first validation error message (in Indonesian, from the schema).
 *
 * Usage:
 *   const parsed = await parseJsonBody(request, mySchema);
 *   if ("error" in parsed) return parsed.error;
 *   const { field1, field2 } = parsed.data;
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ data: T } | { error: NextResponse }> {
  const raw = await request.json().catch(() => null);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Data tidak valid.";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { data: result.data };
}

/** Parses a route param (e.g. `[id]`) as a positive integer, or returns null. */
export function parseIntId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export function invalidIdResponse(): NextResponse {
  return NextResponse.json({ error: "Id tidak valid." }, { status: 400 });
}
