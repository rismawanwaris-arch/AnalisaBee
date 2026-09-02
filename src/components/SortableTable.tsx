"use client";

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
  /** Optional label shown in the control bar above the table, e.g. "42 outlet". */
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
      // Names default to A-Z, numeric columns default to highest-first.
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
    <div className="rounded border border-border bg-surface overflow-hidden">
      {caption && (
        <div className="px-3 py-2 bg-surface-subtle border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
            {caption}
          </span>
          <span className="text-[10px] font-mono text-faint">{sorted.length} baris</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-subtle">
            <tr>
              {columns.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider cursor-pointer select-none border-b border-border whitespace-nowrap transition-colors ${
                      active ? "text-foreground" : "text-muted hover:text-foreground"
                    } ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {col.label}
                    <span className="ml-1 inline-block w-2">
                      {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-surface-hover transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${
                      col.align === "right"
                        ? "text-right font-mono tabular-nums text-foreground"
                        : "text-left"
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
