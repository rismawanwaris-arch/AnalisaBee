"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

interface ItemOption {
  id: number;
  code: string;
  name: string;
  itemGroup: string | null;
}

interface DetailRow {
  outletId: number;
  outletName: string;
  tanggal: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
  transactionCount: number;
}

interface ByOutlet {
  outletId: number;
  outletName: string;
  qty: number;
  subtotal: number;
}

interface ItemDetail {
  item: { id: number; code: string; name: string; itemGroup: string | null };
  totals: {
    qty: number;
    subtotal: number;
    labaRugi: number;
    transactionCount: number;
    outletCount: number;
  };
  byOutlet: ByOutlet[];
  rows: DetailRow[];
}

export function ItemExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ItemOption[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowOptions(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query)}`);
      if (res.ok) setOptions(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/items/${id}?${params.toString()}`);
      if (res.ok) setDetail(await res.json());
      setLoading(false);
    },
    [from, to]
  );

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  function selectItem(opt: ItemOption) {
    setQuery(`${opt.name} (${opt.code})`);
    setShowOptions(false);
    router.push(`/items?id=${opt.id}`);
  }

  function exportCsv() {
    if (!detail) return;
    downloadCsv(
      `item-${detail.item.code}.csv`,
      ["Outlet", "Tanggal", "Qty", "Omzet", "Laba/Rugi", "Jumlah Transaksi"],
      detail.rows.map((r) => [
        r.outletName,
        formatDate(r.tanggal),
        r.qty,
        r.subtotal,
        r.labaRugi,
        r.transactionCount,
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-bold">Cari Item</h1>
        <p className="text-sm text-muted mt-1">
          Pilih satu item untuk melihat terjual di outlet mana, berapa pcs, dan tanggal berapa.
        </p>
      </div>

      <div ref={boxRef} className="relative max-w-lg">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowOptions(true);
          }}
          onFocus={() => setShowOptions(true)}
          placeholder="Ketik nama atau kode item..."
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {showOptions && options.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface shadow-lg max-h-72 overflow-y-auto">
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => selectItem(opt)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-background flex justify-between gap-2"
                >
                  <span>{opt.name}</span>
                  <span className="text-muted shrink-0">{opt.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <div className="text-sm text-muted">Memuat data...</div>}

      {detail && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{detail.item.name}</h2>
              <p className="text-sm text-muted">
                Kode {detail.item.code}
                {detail.item.itemGroup ? ` · ${detail.item.itemGroup}` : ""}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-muted mb-1">Dari tanggal</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Sampai tanggal</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => selectedId && loadDetail(selectedId)}
                className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm hover:opacity-90"
              >
                Terapkan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Qty Terjual" value={formatNumber(detail.totals.qty)} />
            <StatCard label="Total Omzet" value={formatRupiah(detail.totals.subtotal)} />
            <StatCard label="Total Laba" value={formatRupiah(detail.totals.labaRugi)} />
            <StatCard label="Jumlah Outlet" value={formatNumber(detail.totals.outletCount)} />
          </div>

          {detail.byOutlet.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Qty Terjual per Outlet</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, detail.byOutlet.length * 28)}>
                <BarChart
                  data={detail.byOutlet}
                  layout="vertical"
                  margin={{ left: 24, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={formatNumber} fontSize={12} stroke="var(--muted)" />
                  <YAxis
                    type="category"
                    dataKey="outletName"
                    width={140}
                    fontSize={12}
                    interval={0}
                    stroke="var(--muted)"
                  />
                  <Tooltip
                    formatter={(v) => formatNumber(Number(v))}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="qty" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Detail per Outlet & Tanggal</h3>
              <button
                type="button"
                onClick={exportCsv}
                className="text-sm text-muted hover:text-foreground underline"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Outlet</th>
                    <th className="px-4 py-2 font-medium">Tanggal</th>
                    <th className="px-4 py-2 font-medium text-right">Qty</th>
                    <th className="px-4 py-2 font-medium text-right">Omzet</th>
                    <th className="px-4 py-2 font-medium text-right">Laba/Rugi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted">
                        Tidak ada penjualan pada rentang tanggal ini.
                      </td>
                    </tr>
                  )}
                  {detail.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{r.outletName}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.tanggal)}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(r.qty)}</td>
                      <td className="px-4 py-2 text-right">{formatRupiah(r.subtotal)}</td>
                      <td className="px-4 py-2 text-right">{formatRupiah(r.labaRugi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!detail && !loading && (
        <div className="text-sm text-muted border border-dashed border-border rounded-lg p-8 text-center">
          Cari dan pilih item di atas untuk melihat detail penjualannya.
        </div>
      )}
    </div>
  );
}
