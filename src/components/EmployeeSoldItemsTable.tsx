import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";

export interface SoldItemRow {
  itemId: number;
  code: string;
  name: string;
  itemGroup: string | null;
  brand: string | null;
  qty: number;
  subtotal: number;
  labaRugi: number;
  outlets: { outletId: number; outletName: string; qty: number; subtotal: number }[];
}

interface EmployeeSoldItemsTableProps {
  items: SoldItemRow[];
  maxHeight?: string;
}

type SortKey = "name" | "qty" | "subtotal" | "labaRugi";

export function EmployeeSoldItemsTable({ items, maxHeight = "max-h-[60vh]" }: EmployeeSoldItemsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("subtotal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.brand && it.brand.toLowerCase().includes(q)) ||
        (it.itemGroup && it.itemGroup.toLowerCase().includes(q))
    );
  }, [items, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "id");
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, it) => {
        acc.qty += it.qty;
        acc.subtotal += it.subtotal;
        acc.labaRugi += it.labaRugi;
        return acc;
      },
      { qty: 0, subtotal: 0, labaRugi: 0 }
    );
  }, [sorted]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <span className="text-muted/40 ml-1">↕</span>;
    }
    return <span className="text-accent ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama barang atau kode..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-subtle/50 border border-border/80 rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="text-[11px] text-muted">
          Menampilkan <strong className="text-foreground">{formatNumber(sorted.length)}</strong> dari{" "}
          <strong>{formatNumber(items.length)}</strong> jenis barang
        </div>
      </div>

      <div className={`overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-xs ${maxHeight}`}>
        <table className="w-full text-xs">
          <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80 sticky top-0 z-10 backdrop-blur-xs">
            <tr>
              <th className="px-3 py-2.5 font-semibold text-[11px] uppercase w-10 text-center">No</th>
              <th
                onClick={() => handleSort("name")}
                className="px-4 py-2.5 font-semibold text-[11px] uppercase cursor-pointer hover:text-foreground select-none"
              >
                Nama Barang {sortIcon("name")}
              </th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Kode SKU</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Kategori / Merk</th>
              <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Outlet</th>
              <th
                onClick={() => handleSort("qty")}
                className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right cursor-pointer hover:text-foreground select-none"
              >
                Qty Terjual {sortIcon("qty")}
              </th>
              <th
                onClick={() => handleSort("subtotal")}
                className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right cursor-pointer hover:text-foreground select-none"
              >
                Total Omzet {sortIcon("subtotal")}
              </th>
              <th
                onClick={() => handleSort("labaRugi")}
                className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right cursor-pointer hover:text-foreground select-none"
              >
                Total Laba {sortIcon("labaRugi")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted">
                  {items.length === 0
                    ? "Tidak ada barang yang terjual sesuai filter yang dipilih."
                    : "Tidak ada barang yang cocok dengan pencarian."}
                </td>
              </tr>
            ) : (
              sorted.map((it, idx) => {
                const outletSummary =
                  it.outlets.length === 0
                    ? "—"
                    : it.outlets.length === 1
                    ? it.outlets[0].outletName
                    : `${it.outlets[0].outletName} (+${it.outlets.length - 1})`;

                return (
                  <tr key={it.itemId} className="hover:bg-surface-hover/70 transition-colors">
                    <td className="px-3 py-2.5 text-center text-muted font-mono text-[11px]">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link to={`/items?id=${it.itemId}`} className="hover:text-accent hover:underline">
                        {it.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted text-[11px]">{it.code || "—"}</td>
                    <td className="px-4 py-2.5 text-muted text-[11px]">
                      {[it.brand, it.itemGroup].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted text-[11px]" title={it.outlets.map((o) => `${o.outletName} (${o.qty} pcs)`).join(", ")}>
                      {outletSummary}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-right text-foreground font-medium">
                      {formatNumber(it.qty)} pcs
                    </td>
                    <td className="px-4 py-2.5 font-mono text-right text-foreground font-semibold">
                      {formatRupiah(it.subtotal)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-right text-foreground font-semibold">
                      {formatRupiah(it.labaRugi)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-surface-subtle/80 font-semibold border-t-2 border-border/80 text-foreground sticky bottom-0">
              <tr>
                <td colSpan={5} className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted">
                  Total Terfilter ({formatNumber(sorted.length)} barang)
                </td>
                <td className="px-4 py-2.5 font-mono text-right text-foreground">{formatNumber(totals.qty)} pcs</td>
                <td className="px-4 py-2.5 font-mono text-right text-foreground">{formatRupiah(totals.subtotal)}</td>
                <td className="px-4 py-2.5 font-mono text-right text-foreground">{formatRupiah(totals.labaRugi)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
