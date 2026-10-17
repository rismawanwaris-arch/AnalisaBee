import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
import { SortableTable, type Column } from "@/components/SortableTable";
import { ItemPicker, type ItemOption } from "@/components/ItemPicker";
import { EmployeeSoldItemsModal } from "@/components/EmployeeSoldItemsModal";
import { todayStr } from "@/lib/dateDefaults";
import { usePeriod } from "@/context/PeriodContext";

interface EmployeeRow {
  id: number;
  name: string;
  qty: number;
  subtotal: number;
  labaRugi: number;
  transactionCount: number;
}

interface OutletOption {
  id: number;
  name: string;
}

interface ItemFilterOptions {
  itemGroups: string[];
  brands: string[];
}

function startOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const makeColumns = (qs: string, onSelectEmployee: (e: EmployeeRow) => void): Column<EmployeeRow>[] => [
  {
    key: "name",
    label: "Pegawai",
    accessor: (e) => e.name,
    render: (e) => (
      <a
        href={`/employees/${e.id}${qs}`}
        onClick={(evt) => {
          if (!evt.ctrlKey && !evt.metaKey && !evt.shiftKey && !evt.altKey && evt.button === 0) {
            evt.preventDefault();
            onSelectEmployee(e);
          }
        }}
        className="hover:text-accent hover:underline font-medium text-foreground cursor-pointer"
        title="Klik untuk langsung melihat daftar barang yang dijual"
      >
        {e.name}
      </a>
    ),
  },
  {
    key: "qty",
    label: "Qty Terjual",
    align: "right",
    accessor: (e) => e.qty,
    render: (e) => `${formatNumber(e.qty)} pcs`,
    totalRender: (total) => `${formatNumber(total)} pcs`,
  },
  {
    key: "subtotal",
    label: "Total Omzet",
    align: "right",
    accessor: (e) => e.subtotal,
    render: (e) => formatRupiah(e.subtotal),
    totalRender: (total) => formatRupiah(total),
  },
  {
    key: "labaRugi",
    label: "Total Laba",
    align: "right",
    accessor: (e) => e.labaRugi,
    render: (e) => formatRupiah(e.labaRugi),
    totalRender: (total) => formatRupiah(total),
  },
  {
    key: "transactionCount",
    label: "Jumlah Transaksi",
    align: "right",
    accessor: (e) => e.transactionCount,
    render: (e) => `${formatNumber(e.transactionCount)} struk`,
    totalRender: (total) => `${formatNumber(total)} struk`,
  },
];

export function EmployeesPage() {
  const { currentPeriod, loaded: periodLoaded } = usePeriod();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [filterOptions, setFilterOptions] = useState<ItemFilterOptions>({ itemGroups: [], brands: [] });
  const [loading, setLoading] = useState(true);

  // Filter state — initialised from current period once loaded
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const periodInitialised = useRef(false);
  useEffect(() => {
    if (periodLoaded && !periodInitialised.current) {
      periodInitialised.current = true;
      setFrom(currentPeriod.from);
      setTo(currentPeriod.to);
    }
  }, [periodLoaded, currentPeriod.from, currentPeriod.to]);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [outletId, setOutletId] = useState("");
  const [subtotalMin, setSubtotalMin] = useState("");
  const [subtotalMax, setSubtotalMax] = useState("");
  const [itemGroup, setItemGroup] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [brand, setBrand] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBrand(brandInput.trim()), 350);
    return () => clearTimeout(t);
  }, [brandInput]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/outlets", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: number; name: string }[]) =>
        setOutlets(list.map((o) => ({ id: o.id, name: o.name })))
      )
      .catch(() => {});
    fetch("/api/items/filter-options", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((opts: ItemFilterOptions | null) => {
        if (opts) setFilterOptions(opts);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (selectedItem) params.set("itemId", String(selectedItem.id));
      if (outletId) params.set("outletId", outletId);
      if (subtotalMin) params.set("subtotalMin", subtotalMin);
      if (subtotalMax) params.set("subtotalMax", subtotalMax);
      if (itemGroup) params.set("itemGroup", itemGroup);
      if (brand) params.set("itemKeyword", brand);
      const res = await fetch(`/api/employees/summary?${params}`);
      if (res.ok) setEmployees(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedItem, outletId, subtotalMin, subtotalMax, itemGroup, brand]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const SHORTCUTS = useMemo(() => [
    { label: "Hari Ini", from: todayStr(), to: todayStr() },
    { label: "Minggu Ini", from: startOfWeekStr(), to: todayStr() },
    { label: "Bulan Ini", from: currentPeriod.from, to: currentPeriod.to },
    { label: "Semua", from: "", to: "" },
  ], [currentPeriod.from, currentPeriod.to]);

  function applyShortcut(s: { label: string; from: string; to: string }) {
    setFrom(s.from);
    setTo(s.to);
  }

  function resetFilters() {
    setFrom(currentPeriod.from);
    setTo(currentPeriod.to);
    setEmployeeSearch("");
    setSelectedItem(null);
    setOutletId("");
    setSubtotalMin("");
    setSubtotalMax("");
    setItemGroup("");
    setBrandInput("");
    setBrand("");
  }

  const filtered = employeeSearch.trim()
    ? employees.filter((e) => e.name.toLowerCase().includes(employeeSearch.toLowerCase()))
    : employees;

  const detailQs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (selectedItem) {
      p.set("itemId", String(selectedItem.id));
      p.set("itemName", selectedItem.name);
    }
    if (outletId) p.set("outletId", outletId);
    if (itemGroup) p.set("itemGroup", itemGroup);
    if (brand) p.set("itemKeyword", brand);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [from, to, selectedItem, outletId, itemGroup, brand]);

  const columns = useMemo(
    () => makeColumns(detailQs, (e) => setSelectedEmployee({ id: e.id, name: e.name })),
    [detailQs]
  );

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (brand) labels.push(`Merk/Kata Kunci: ${brand}`);
    if (selectedItem) labels.push(`Item: ${selectedItem.name}`);
    if (itemGroup) labels.push(`Kategori: ${itemGroup}`);
    if (outletId) {
      const o = outlets.find((x) => String(x.id) === outletId);
      labels.push(`Outlet: ${o?.name ?? outletId}`);
    }
    if (from || to) {
      labels.push(`Periode: ${from || "…"} s/d ${to || "…"}`);
    }
    return labels;
  }, [brand, selectedItem, itemGroup, outletId, outlets, from, to]);

  const hasFilter = employeeSearch || selectedItem || outletId || subtotalMin || subtotalMax
    || itemGroup || brandInput || from !== currentPeriod.from || to !== currentPeriod.to;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Performa Pegawai &amp; Staff</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Matriks komparasi produktivitas sales, laba, dan volume transaksi yang dilayani oleh setiap pegawai.
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        {/* Row 1: dates + shortcuts */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="employees-from" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Mulai</label>
            <input
              id="employees-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="employees-to" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Selesai</label>
            <input
              id="employees-to"
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

        {/* Row 2: search, item picker, category, brand, outlet, amount */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Employee search */}
          <div className="flex flex-col gap-1 min-w-0 flex-1" style={{ minWidth: "160px", maxWidth: "220px" }}>
            <label htmlFor="employees-search" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Cari Pegawai</label>
            <input
              id="employees-search"
              type="text"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Nama pegawai..."
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          {/* Item picker */}
          <div className="flex flex-col gap-1 min-w-0 flex-1" style={{ minWidth: "200px", maxWidth: "300px" }}>
            <label htmlFor="employees-item-filter" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Filter Item</label>
            <ItemPicker
              inputId="employees-item-filter"
              selected={selectedItem}
              onSelect={setSelectedItem}
              placeholder="Ketik nama atau kode item..."
            />
          </div>

          {/* Kategori (Item.itemGroup) */}
          <div className="flex flex-col gap-1 min-w-0" style={{ minWidth: "150px", maxWidth: "200px" }}>
            <label htmlFor="employees-item-group" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Kategori</label>
            <select
              id="employees-item-group"
              value={itemGroup}
              onChange={(e) => setItemGroup(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            >
              <option value="">Semua kategori</option>
              {filterOptions.itemGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Merk / kata kunci item */}
          <div className="flex flex-col gap-1 min-w-0" style={{ minWidth: "170px", maxWidth: "220px" }}>
            <label htmlFor="employees-brand" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Merk / Kata Kunci Item</label>
            <input
              id="employees-brand"
              type="text"
              list="employees-brand-suggestions"
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              placeholder="cth: ufone+uime"
              title="Bisa beberapa kata kunci dengan tanda +, contoh: ufone+uime"
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
            <datalist id="employees-brand-suggestions">
              {filterOptions.brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          {/* Outlet */}
          <div className="flex flex-col gap-1 min-w-0" style={{ minWidth: "160px", maxWidth: "220px" }}>
            <label htmlFor="employees-outlet" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Outlet</label>
            <select
              id="employees-outlet"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            >
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Amount range */}
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="employees-omzet-min" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Omzet Min (Rp)</label>
            <input
              id="employees-omzet-min"
              type="number"
              value={subtotalMin}
              onChange={(e) => setSubtotalMin(e.target.value)}
              placeholder="0"
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all w-32"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="employees-omzet-max" className="text-[10px] font-semibold uppercase tracking-wider text-muted">Omzet Max (Rp)</label>
            <input
              id="employees-omzet-max"
              type="number"
              value={subtotalMax}
              onChange={(e) => setSubtotalMax(e.target.value)}
              placeholder="Tak terhingga"
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all w-32"
            />
          </div>
        </div>
      </div>

      {/* Active filter summary */}
      {(selectedItem || outletId || itemGroup || brandInput || from || to) && (
        <p className="text-[11px] text-muted px-0.5">
          Menampilkan {formatNumber(filtered.length)} pegawai
          {from && to ? ` · ${from} s/d ${to}` : from ? ` · dari ${from}` : to ? ` · s/d ${to}` : ""}
          {selectedItem ? ` · item: ${selectedItem.name}` : ""}
          {itemGroup ? ` · kategori: ${itemGroup}` : ""}
          {brandInput ? ` · merk/kata kunci: ${brandInput}` : ""}
          {outletId ? ` · outlet: ${outlets.find((o) => String(o.id) === outletId)?.name ?? ""}` : ""}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat data pegawai...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted">
          Tidak ada data pegawai yang sesuai filter.
        </div>
      ) : (
        <SortableTable
          rows={filtered}
          columns={columns}
          rowKey={(e) => e.id}
          defaultSortKey="subtotal"
          caption="Matrix Pegawai"
          showTotal
        />
      )}

      {selectedEmployee && (
        <EmployeeSoldItemsModal
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.name}
          filterQuery={detailQs}
          filterLabels={activeFilterLabels}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
