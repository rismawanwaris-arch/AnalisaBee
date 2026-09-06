/** Quotes a CSV field and neutralizes formula injection: Excel/Sheets treat a
 *  cell starting with = + - @ (or tab/CR) as a formula, which is dangerous
 *  when the value came from an uploaded file rather than something typed by
 *  the exporting user. Prefixing with a tab-safe apostrophe forces text mode
 *  without changing what the cell displays. */
export function csvField(value: unknown): string {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  const needsNeutralizing = /^[=+\-@\t\r]/.test(escaped);
  return `"${needsNeutralizing ? "'" + escaped : escaped}"`;
}
