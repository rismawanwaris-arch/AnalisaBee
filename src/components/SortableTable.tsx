
import { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  accessor: (row: T) => number | string;
  render: (row: T) => React.ReactNode;
}

interface SortableTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  defaultSortKey: string;
  defaultSortDir?: "asc" | "desc";
  emptyMessage?: string;
  caption?: string;
}

export function SortableTable<T>({
  rows,
  columns,
  rowKey,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyMessage = "Belum ada data.",
  caption,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (typeof va === "string" || typeof vb === "string") {
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [rows, columns, sortKey, sortDir]);

  return (
    <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
      {caption && (
        <div className="px-4 py-3 bg-surface-subtle/70 border-b border-border/80 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {caption}
          </span>
          <span className="text-[11px] font-mono text-muted bg-surface border border-border/60 rounded px-1.5 py-0.5 font-medium">
            {sorted.length} baris
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-subtle/60 border-b border-border/80">
            <tr>
              {columns.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors ${
                      active ? "text-accent bg-accent/5 font-bold" : "text-muted hover:text-foreground"
                    } ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <span className="text-[10px] opacity-70">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-surface-hover/70 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 ${
                      col.align === "right"
                        ? "text-right font-mono tabular-nums text-foreground font-medium"
                        : "text-left text-foreground"
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
