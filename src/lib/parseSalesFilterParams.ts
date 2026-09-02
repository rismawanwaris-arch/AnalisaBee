import type { SalesFilters } from "@/lib/queries/sales";

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseIntParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

function parseNumberParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** HTML <input type="time"> only gives "HH:MM" — pad the upper bound to
 * "HH:MM:59" so filtering "sampai 14:30" includes the whole minute. */
function padJamTo(v: string | null): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  return s.length === 5 ? `${s}:59` : s;
}

export function parseSalesFilterParams(searchParams: URLSearchParams): SalesFilters {
  return {
    from: parseDateParam(searchParams.get("from")),
    to: parseDateParam(searchParams.get("to")),
    itemId: parseIntParam(searchParams.get("itemId")),
    outletId: parseIntParam(searchParams.get("outletId")),
    employeeId: parseIntParam(searchParams.get("employeeId")),
    noTransaksi: searchParams.get("noTransaksi")?.trim() || undefined,
    jamFrom: searchParams.get("jamFrom")?.trim() || undefined,
    jamTo: padJamTo(searchParams.get("jamTo")),
    qtyMin: parseNumberParam(searchParams.get("qtyMin")),
    qtyMax: parseNumberParam(searchParams.get("qtyMax")),
    subtotalMin: parseNumberParam(searchParams.get("subtotalMin")),
    subtotalMax: parseNumberParam(searchParams.get("subtotalMax")),
    labaRugiMin: parseNumberParam(searchParams.get("labaRugiMin")),
    labaRugiMax: parseNumberParam(searchParams.get("labaRugiMax")),
  };
}
