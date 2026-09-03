import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

export function ItemsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      try {
        const res = await fetch(`/api/items?q=${encodeURIComponent(query)}`);
        if (res.ok) setOptions(await res.json());
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      try {
        const res = await fetch(`/api/items/${id}?${params.toString()}`);
        if (res.ok) setDetail(await res.json());
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
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
    navigate(`/items?id=${opt.id}`);
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
        <h1 className="text-lg font-bold text-foreground tracking-tight">Cari &amp; Eksplorasi Item</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Pilih item untuk menganalisis sebaran penjualan per outlet, total kuantitas, omzet, dan riwayat per tanggal.
        </p>
      </div>

      <div ref={boxRef} className="relative max-w-xl">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowOptions(true);
            }}
            onFocus={() => setShowOptions(true)}
            placeholder="Cari berdasarkan nama atau kode item/SKU..."
            className="w-full rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent shadow-xs transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setOptions([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {showOptions && options.length > 0 && (
          <ul className="absolute z-30 mt-1.5 w-full rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md shadow-xl max-h-72 overflow-y-auto divide-y divide-border/40 py-1">
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => selectItem(opt)}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-surface-hover flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="font-medium text-foreground truncate">{opt.name}</span>
                  <span className="text-[11px] font-mono text-muted shrink-0 bg-surface-subtle px-1.5 py-0.5 rounded border border-border/50">
                    {opt.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-4">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat data performa item...</span>
        </div>
      )}

      {detail && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                <h2 className="text-base font-bold text-foreground">{detail.item.name}</h2>
              </div>
              <p className="text-xs text-muted font-mono mt-0.5">
                Kode: <strong className="text-foreground">{detail.item.code}</strong>
                {detail.item.itemGroup ? ` · Kategori: ${detail.item.itemGroup}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => selectedId && loadDetail(selectedId)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent text-accent-foreground px-3.5 py-1 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                Terapkan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="Total Qty Terjual" value={`${formatNumber(detail.totals.qty)} pcs`} />
            <StatCard label="Total Omzet" value={formatRupiah(detail.totals.subtotal)} />
            <StatCard label="Total Laba" value={formatRupiah(detail.totals.labaRugi)} />
            <StatCard label="Jumlah Outlet" value={`${formatNumber(detail.totals.outletCount)} outlet`} />
          </div>

          {detail.byOutlet.length > 0 && (
            <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                Sebaran Kuantitas Terjual per Outlet
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(220, detail.byOutlet.length * 30)}>
                <BarChart
                  data={detail.byOutlet}
                  layout="vertical"
                  margin={{ left: 10, right: 24, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--chart-grid)" />
                  <XAxis type="number" tickFormatter={formatNumber} fontSize={11} stroke="var(--border)" tick={{ fill: "var(--muted)" }} />
                  <YAxis
                    type="category"
                    dataKey="outletName"
                    width={130}
                    fontSize={11}
                    interval={0}
                    stroke="var(--border)"
                    tick={{ fill: "var(--foreground)", fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(v) => [`${formatNumber(Number(v))} pcs`, "Kuantitas"]}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="qty" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Detail Transaksi per Outlet &amp; Tanggal
              </h3>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                <span>Unduh CSV</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
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
