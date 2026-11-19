import { csvField } from "./csvSafe";

export function escapeCsvCell(v: string | number): string {
  if (typeof v === "number") {
    return Number.isFinite(v) ? String(v) : "";
  }
  return csvField(v);
}

export function buildCsvContent(
  headers: string[],
  rows: (string | number)[][]
): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsvCell).join(","));
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const blob = new Blob([buildCsvContent(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
