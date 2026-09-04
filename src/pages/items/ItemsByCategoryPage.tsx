import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
import { SortableTable, type Column } from "@/components/SortableTable";
import { todayStr } from "@/lib/dateDefaults";
import { useMonthPeriod } from "@/lib/useMonthPeriod";

interface ItemRow {
  itemId: number;
  code: string;
  name: string;
  itemGroup: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
}


const COLUMNS: Column<ItemRow>[] = [
  {
    key: "itemGroup",
    label: "Kategori",
    accessor: (r) => r.itemGroup,
    render: (r) => (
      <span className="inline-block rounded-md bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        {r.itemGroup}
      </span>
    ),
  },
  {
    key: "name",
    label: "Nama Item",
    accessor: (r) => r.name,
    render: (r) => (
      <Link
        to={`/items?id=${r.itemId}`}
        className="hover:text-accent hover:underline font-medium text-foreground"
      >
        {r.name}
      </Link>
    ),
  },
  {
    key: "code",
    label: "Kode SKU",
    accessor: (r) => r.code,
    render: (r) => <span className="font-mono text-muted text-[11px]">{r.code}</span>,
  },
  {
    key: "qty",
    label: "Qty Terjual",
    align: "right",
    accessor: (r) => r.qty,
    render: (r) => `${formatNumber(r.qty)} pcs`,
  },
  {
    key: "subtotal",
    label: "Total Omzet",
    align: "right",
    accessor: (r) => r.subtotal,
    render: (r) => formatRupiah(r.subtotal),
  },
  {
    key: "labaRugi",
    label: "Total Laba",
    align: "right",
    accessor: (r) => r.labaRugi,
    render: (r) => formatRupiah(r.labaRugi),
  },
];

export function ItemsByCategoryPage() {
  const { currentPeriod, loaded: periodLoaded } = useMonthPeriod();
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (periodLoaded && !from && !to) {
      setFrom(currentPeriod.from);
      setTo(currentPeriod.to);
    }
  }, [periodLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const [categorySearch, setCategorySearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [groupMode, setGroupMode] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/items/by-category?${params}`);
      if (res.ok) setRows(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let result = rows;
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase();
      result = result.filter((r) => r.itemGroup.toLowerCase().includes(q));
    }
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, categorySearch, itemSearch]);

  // Unique categories for the group summary
  const categorySummary = useMemo(() => {
    const map = new Map<string, { qty: number; subtotal: number; labaRugi: number; count: number }>();
    for (const r of filtered) {
      const existing = map.get(r.itemGroup);
      if (existing) {
        existing.qty += r.qty;
        existing.subtotal += r.subtotal;
        existing.labaRugi += r.labaRugi;
        existing.count++;
      } else {
        map.set(r.itemGroup, { qty: r.qty, subtotal: r.subtotal, labaRugi: r.labaRugi, count: 1 });
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Item Terlaris per Kategori</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Performa penjualan item dikelompokkan berdasarkan kategori produk.
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Mulai</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Selesai</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap pb-0.5">
            {[
              { label: "Hari Ini", from: todayStr(), to: todayStr() },
              { label: "Bulan Ini", from: currentPeriod.from, to: currentPeriod.to },
              { label: "Semua", from: "", to: "" },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => { setFrom(s.from); setTo(s.to); }}
                className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "160px", maxWidth: "240px" }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Filter Kategori</label>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Nama kategori..."
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "160px", maxWidth: "280px" }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Cari Item</label>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Nama atau kode SKU..."
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1 pb-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted invisible">Mode</label>
            <button
              type="button"
              onClick={() => setGroupMode((g) => !g)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                groupMode
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border/80 bg-surface-subtle text-muted hover:text-foreground"
              }`}
            >
              {groupMode ? "▦ Tampilan Ringkasan Kategori" : "▤ Tampilan Semua Item"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat data item...</span>
        </div>
      ) : groupMode ? (
        /* Group summary view */
        <div className="space-y-2">
          <p className="text-[11px] text-muted px-0.5">{categorySummary.length} kategori</p>
          {categorySummary.map((cat) => (
            <CategoryGroup
              key={cat.name}
              name={cat.name}
              total={cat}
              items={filtered.filter((r) => r.itemGroup === cat.name)}
            />
          ))}
        </div>
      ) : (
        /* Flat table view */
        <>
          <p className="text-[11px] text-muted px-0.5">{formatNumber(filtered.length)} item</p>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted">
              Tidak ada item yang sesuai filter.
            </div>
          ) : (
            <SortableTable
              rows={filtered}
              columns={COLUMNS}
              rowKey={(r) => r.itemId}
              defaultSortKey="subtotal"
              caption="Item per Kategori"
            />
          )}
        </>
      )}
    </div>
  );
}

function CategoryGroup({
  name,
  total,
  items,
}: {
  name: string;
  total: { qty: number; subtotal: number; labaRugi: number; count: number };
  items: ItemRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/50 transition-colors text-left"
      >
        <span className="text-muted text-[11px] w-3 shrink-0">{open ? "▾" : "▸"}</span>
        <span className="flex-1 text-xs font-bold text-foreground uppercase tracking-wide">{name}</span>
        <span className="text-[11px] text-muted shrink-0">{total.count} item</span>
        <span className="text-[11px] text-muted shrink-0 ml-3">{formatNumber(total.qty)} pcs</span>
        <span className="text-[11px] font-semibold text-foreground font-mono shrink-0 ml-3">{formatRupiah(total.subtotal)}</span>
        <span className="text-[11px] text-muted font-mono shrink-0 ml-2">laba {formatRupiah(total.labaRugi)}</span>
      </button>

      {open && (
        <div className="border-t border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle/60 text-muted text-left">
              <tr>
                <th className="px-4 py-2 font-semibold text-[10px] uppercase">Nama Item</th>
                <th className="px-4 py-2 font-semibold text-[10px] uppercase">Kode SKU</th>
                <th className="px-4 py-2 font-semibold text-[10px] uppercase text-right">Qty</th>
                <th className="px-4 py-2 font-semibold text-[10px] uppercase text-right">Omzet</th>
                <th className="px-4 py-2 font-semibold text-[10px] uppercase text-right">Laba</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items
                .slice()
                .sort((a, b) => b.subtotal - a.subtotal)
                .map((r) => (
                  <tr key={r.itemId} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-2 font-medium text-foreground">
                      <Link to={`/items?id=${r.itemId}`} className="hover:text-accent hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-muted text-[10px]">{r.code}</td>
                    <td className="px-4 py-2 font-mono text-right">{formatNumber(r.qty)}</td>
                    <td className="px-4 py-2 font-mono text-right font-semibold">{formatRupiah(r.subtotal)}</td>
                    <td className="px-4 py-2 font-mono text-right text-muted">{formatRupiah(r.labaRugi)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
