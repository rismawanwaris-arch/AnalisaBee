import type { Prisma } from "@/generated/prisma/client";

/**
 * Parses a raw item keyword query into distinct search terms.
 * Supports multi-keyword combinations using '+' or ','
 * e.g. "ufone+uime" -> ["ufone", "uime", "ui me"]
 * Also expands known aliases / spelling variations (e.g. "uime" <-> "ui me").
 */
export function parseItemKeywords(raw?: string | null): string[] {
  if (!raw) return [];
  const parts = raw.split(/[+,]+/).map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    result.push(part);
    const lower = part.toLowerCase();
    if (lower === "uime" || lower === "ui me" || lower === "ui-me") {
      result.push("uime", "ui me", "ui-me");
    } else if (lower === "powerbank" || lower === "power bank" || lower === "power-bank") {
      result.push("powerbank", "power bank", "power-bank");
    }
  }

  return Array.from(new Set(result));
}

/**
 * Builds Prisma `item` where condition for multi-keyword search.
 * Matches against BOTH `Item.name` and `Item.brand` (Merk) so items curated
 * via Master Item's "Merk" column or items matching by name are all selected.
 */
export function buildItemKeywordWhere(rawKeyword?: string | null): Prisma.ItemWhereInput {
  const keywords = parseItemKeywords(rawKeyword);
  if (keywords.length === 0) return {};
  return {
    OR: keywords.flatMap((kw) => [
      { name: { contains: kw, mode: "insensitive" } },
      { brand: { contains: kw, mode: "insensitive" } },
    ]),
  };
}
