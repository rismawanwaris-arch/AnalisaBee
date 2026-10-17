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
    if (lower === "uime") {
      result.push("ui me");
    } else if (lower === "ui me") {
      result.push("uime");
    } else if (lower === "powerbank") {
      result.push("power bank");
    } else if (lower === "power bank") {
      result.push("powerbank");
    }
  }

  return Array.from(new Set(result));
}

/**
 * Builds Prisma `item` where condition for multi-keyword search.
 * When multiple keywords are provided (e.g. ufone+uime), generates an OR clause
 * so items matching ANY of the keywords are included.
 */
export function buildItemKeywordWhere(rawKeyword?: string | null): Prisma.ItemWhereInput {
  const keywords = parseItemKeywords(rawKeyword);
  if (keywords.length === 0) return {};
  if (keywords.length === 1) {
    return { name: { contains: keywords[0], mode: "insensitive" } };
  }
  return {
    OR: keywords.map((kw) => ({ name: { contains: kw, mode: "insensitive" } })),
  };
}
