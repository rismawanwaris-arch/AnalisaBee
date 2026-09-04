import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
import { SortableTable, type Column } from "@/components/SortableTable";
import { ItemPicker, type ItemOption } from "@/components/ItemPicker";
import { todayStr } from "@/lib/dateDefaults";
import { useMonthPeriod } from "@/lib/useMonthPeriod";

interface OutletRow {
  id: number;
  name: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
  transactionCount: number;
}

interface EmployeeOption {
  id: number;
  name: string;
}

function startOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const columns: Column<OutletRow>[] = [
  {
    key: "name",
    label: "Outlet",
    accessor: (o) => o.name,
    render: (o) => (
      <Link to={`/outlets/${o.id}`} className="hover:text-accent hover:underline font-medium text-foreground">
        {o.name}
      </Link>
    ),
  },
  {
    key: "qty",
    label: "Qty Terjual",
    align: "right",
    accessor: (o) => o.qty,
    render: (o) => `${formatNumber(o.qty)} pcs`,
  },
  {
    key: "subtotal",
    label: "Total Omzet",
    align: "right",
    accessor: (o) => o.subtotal,
    render: (o) => formatRupiah(o.subtotal),
  },
  {
    key: "labaRugi",
    label: "Total Laba",
    align: "right",
    accessor: (o) => o.labaRugi,
    render: (o) => formatRupiah(o.labaRugi),
  },
  {
    key: "transactionCount",
    label: "Jumlah Transaksi",
    align: "right",
    accessor: (o) => o.transactionCount,
    render: (o) => `${formatNumber(o.transactionCount)} struk`,
  },
];

export function OutletsPage() {
  const { currentPeriod, periodStartDay, loaded: periodLoaded } = useMonthPeriod();
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state — initialised from custom period once loaded
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (periodLoaded && !from && !to) {
      setFrom(currentPeriod.from);
      setTo(currentPeriod.to);
    }
  }, [periodLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const [outletSearch, setOutletSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [subtotalMin, setSubtotalMin] = useState("");
  const [subtotalMax, setSubtotalMax] = useState("");

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: EmployeeOption[]) =>
        setEmployees([...list].sort((a, b) => a.name.localeCompare(b.name)))
      )
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (selectedItem) params.set("itemId", String(selectedItem.id));
      if (employeeId) params.set("employeeId", employeeId);
      if (subtotalMin) params.set("subtotalMin", subtotalMin);
      if (subtotalMax) params.set("subtotalMax", subtotalMax);
      const res = await fetch(`/api/outlets/summary?${params}`);
      if (res.ok) setOutlets(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedItem, employeeId, subtotalMin, subtotalMax]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const SHORTCUTS = [
    { label: "Hari Ini", from: todayStr(), to: todayStr() },
    { label: "Minggu Ini", from: startOfWeekStr(), to: todayStr() },
    { label: "Bulan Ini", from: currentPeriod.from, to: currentPeriod.to },
    { label: "Semua", from: "", to: "" },
  ];

  function applyShortcut(s: { label: string; from: string; to: string }) {
    setFrom(s.from);
    setTo(s.to);
  }

  function resetFilters() {
    setFrom(currentPeriod.from);
    setTo(currentPeriod.to);
    setOutletSearch("");
    setSelectedItem(null);
    setEmployeeId("");
    setSubtotalMin("");
    setSubtotalMax("");
  }

  const filtered = outletSearch.trim()
    ? outlets.filter((o) => o.name.toLowerCase().includes(outletSearch.toLowerCase()))
    : outlets;

  const hasFilter = outletSearch || selectedItem || employeeId || subtotalMin || subtotalMax
    || from !== currentPeriod.from || to !== currentPeriod.to;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Performa Penjualan Outlet</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Matriks komparasi performa omzet, profit, dan volume penjualan per cabang outlet.
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        {/* Row 1: dates + shortcuts */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Mulai</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Selesai</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          {/* Shortcut buttons */}
          <div className="flex gap-1.5 flex-wrap pb-0.5">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applyShortcut(s)}
                className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Reset */}
          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              title="Reset semua filter"
              className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted hover:text-rose-500 hover:border-rose-500/30 transition-colors pb-0.5"
            >
              ↺ Reset
            </button>
          )}
        </div>

        {/* Row 2: item, outlet search, employee, amount */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Outlet search */}
          <div className="flex flex-col gap-1 min-w-0 flex-1" style={{ minWidth: "160px", maxWidth: "220px" }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Cari Outlet</label>
            <input
              type="text"
              value={outletSearch}
              onChange={(e) => setOutletSearch(e.target.value)}
              placeholder="Nama outlet..."
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          {/* Item picker */}
          <div className="flex flex-col gap-1 min-w-0 flex-1" style={{ minWidth: "200px", maxWidth: "300px" }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Filter Item</label>
            <ItemPicker
              selected={selectedItem}
              onSelect={setSelectedItem}
              placeholder="Ketik nama atau kode item..."
            />
          </div>

          {/* Employee */}
          <div className="flex flex-col gap-1 min-w-0" style={{ minWidth: "160px", maxWidth: "220px" }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Karyawan</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            >
              <option value="">Semua karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Amount range */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Omzet Min (Rp)</label>
            <input
              type="number"
              value={subtotalMin}
              onChange={(e) => setSubtotalMin(e.target.value)}
              placeholder="0"
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all w-32"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Omzet Max (Rp)</label>
            <input
              type="number"
              value={subtotalMax}
              onChange={(e) => setSubtotalMax(e.target.value)}
              placeholder="tak terbatas"
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all w-32"
            />
          </div>
        </div>
      </div>

      {/* Active filter summary */}
      {(selectedItem || employeeId || from || to) && (
        <p className="text-[11px] text-muted px-0.5">
          Menampilkan {formatNumber(filtered.length)} outlet
          {from && to ? ` · ${from} s/d ${to}` : from ? ` · dari ${from}` : to ? ` · s/d ${to}` : ""}
          {selectedItem ? ` · item: ${selectedItem.name}` : ""}
          {employeeId ? ` · karyawan: ${employees.find((e) => String(e.id) === employeeId)?.name ?? ""}` : ""}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat data outlet...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted">
          Tidak ada data outlet yang sesuai filter.
        </div>
      ) : (
        <SortableTable
          rows={filtered}
          columns={columns}
          rowKey={(o) => o.id}
          defaultSortKey="subtotal"
          caption="Matrix Outlet"
        />
      )}
    </div>
  );
}
