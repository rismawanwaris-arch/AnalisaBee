export interface ParsedPointItem {
  pattern: string;
  points: number;
}

export interface ParsePointExcelResult {
  items: ParsedPointItem[];
  ignoredCount: number;
  errors: { row: number; reason: string }[];
}

/** Parses raw 2D array from an Excel sheet (.xlsx, .xls, .csv) into validated point items. */
export function parseExcelPointRows(rows: unknown[][]): ParsePointExcelResult {
  if (!rows || rows.length === 0) {
    return { items: [], ignoredCount: 0, errors: [] };
  }

  // Detect header row if present
  let headerRowIndex = -1;
  let itemColIndex = 0;
  let pointsColIndex = -1;

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const stringRow = row.map((cell) => String(cell ?? "").trim().toLowerCase());

    const hasItemKeyword = stringRow.some((c) =>
      c.includes("nama") || c.includes("barang") || c.includes("item") || c.includes("sku") || c.includes("produk")
    );
    const hasPointKeyword = stringRow.some((c) => c.includes("poin") || c.includes("point"));

    if (hasItemKeyword || hasPointKeyword) {
      headerRowIndex = i;

      const itemIdx = stringRow.findIndex((c) =>
        c.includes("nama") || c.includes("barang") || c.includes("item") || c.includes("sku") || c.includes("produk")
      );
      if (itemIdx !== -1) itemColIndex = itemIdx;

      // Find points column: prioritize "baru" / "new"
      const newPointIdx = stringRow.findIndex((c) =>
        (c.includes("poin") || c.includes("point")) && (c.includes("baru") || c.includes("new"))
      );
      if (newPointIdx !== -1) {
        pointsColIndex = newPointIdx;
      } else {
        // Last column containing "poin" or "point"
        for (let c = stringRow.length - 1; c >= 0; c--) {
          if (stringRow[c].includes("poin") || stringRow[c].includes("point")) {
            pointsColIndex = c;
            break;
          }
        }
      }
      break;
    }
  }

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
  const items: ParsedPointItem[] = [];
  const errors: { row: number; reason: string }[] = [];
  let ignoredCount = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      ignoredCount++;
      continue;
    }

    let pattern = "";
    let points: number | null = null;

    if (pointsColIndex !== -1) {
      pattern = String(row[itemColIndex] ?? "").trim();
      const rawVal = row[pointsColIndex];
      const strVal = String(rawVal ?? "").trim();
      if (strVal === "" || !/\d/.test(strVal)) {
        points = null;
      } else {
        const cleaned = strVal.replace(/[^0-9.-]+/g, "");
        const parsedNum = Number(cleaned);
        if (!Number.isNaN(parsedNum)) {
          points = Math.round(parsedNum);
        }
      }
    } else {
      // Automatic detection without matching headers
      const nonEmpties = row
        .map((cell, idx) => ({ cell, idx, str: String(cell ?? "").trim() }))
        .filter((x) => x.str !== "");

      if (nonEmpties.length >= 2) {
        pattern = nonEmpties[0].str;
        const lastCellStr = nonEmpties[nonEmpties.length - 1].str;
        if (lastCellStr === "" || !/\d/.test(lastCellStr)) {
          points = null;
        } else {
          const cleaned = lastCellStr.replace(/[^0-9.-]+/g, "");
          const parsedNum = Number(cleaned);
          if (!Number.isNaN(parsedNum)) {
            points = Math.round(parsedNum);
          }
        }
      }
    }

    if (!pattern) {
      ignoredCount++;
      continue;
    }

    if (points === null || points < 0 || Number.isNaN(points)) {
      errors.push({ row: i + 1, reason: `Nilai poin untuk "${pattern}" tidak valid.` });
      continue;
    }

    items.push({ pattern, points });
  }

  return { items, ignoredCount, errors };
}
