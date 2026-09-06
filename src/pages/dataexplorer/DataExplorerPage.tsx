import { useCallback, useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { useAuth } from "@/context/AuthContext";
import { formatNumber, formatRupiah } from "@/lib/format";
import { todayStr, yesterdayStr } from "@/lib/dateDefaults";

type Source = "SALE" | "TARTUN" | "SERVER";

interface UnifiedRow {
  id: string;
  source: Source;
  sourceId: number;
  tanggal: string;
  jam: string | null;
  outletId: number;
  outletName: string;
  jumlah: number;
  keterangan: string;
  detail: Record<string, any>;
}

const SOURCE_LABEL: Record<Source, string> = {
  SALE: "Data Penjualan",
  TARTUN: "Data Tarik Tunai",
  SERVER: "Data Komisi Server",
};

const SOURCE_BADGE: Record<Source, string> = {
  SALE: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  TARTUN: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30",
  SERVER: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30",
};

type SortKey = "tanggal" | "outletName" | "jumlah" | "keterangan" | "source";

export function DataExplorerPage() {
  const { role } = useAuth();
  const isMaster = role === "master";

  const [from, setFrom] = useState(yesterdayStr());
  const [to, setTo] = useState(todayStr());
  const [allTime, setAllTime] = useState(false);
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [colFilters, setColFilters] = useState({ tanggal: "", outlet: "", jumlah: "", keterangan: "" });
  const [sourceFilter, setSourceFilter] = useState<Source | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("tanggal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [detailRow, setDetailRow] = useState<UnifiedRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!allTime) {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      const res = await fetch(`/api/data-explorer?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Gagal memuat data.");
        return;
      }
      setRows(await res.json());
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [from, to, allTime]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Clear selection whenever the visible set changes so a row hidden by a
  // new filter can't be bulk-deleted without the user seeing it again.
  useEffect(() => {
    setSelected(new Set());
  }, [rows, sourceFilter, colFilters.tanggal, colFilters.outlet, colFilters.jumlah, colFilters.keterangan]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (sourceFilter) list = list.filter((r) => r.source === sourceFilter);
    if (colFilters.tanggal) list = list.filter((r) => r.tanggal.includes(colFilters.tanggal));
    if (colFilters.outlet) {
      const q = colFilters.outlet.toLowerCase();
      list = list.filter((r) => r.outletName.toLowerCase().includes(q));
    }
    if (colFilters.keterangan) {
      const q = colFilters.keterangan.toLowerCase();
      list = list.filter((r) => r.keterangan.toLowerCase().includes(q));
    }
    if (colFilters.jumlah) {
      const q = colFilters.jumlah.replace(/[^\d]/g, "");
      if (q) list = list.filter((r) => String(Math.round(r.jumlah)).includes(q));
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "tanggal") {
        cmp = `${a.tanggal}${a.jam ?? ""}`.localeCompare(`${b.tanggal}${b.jam ?? ""}`);
      } else if (sortKey === "outletName") {
        cmp = a.outletName.localeCompare(b.outletName);
      } else if (sortKey === "jumlah") {
        cmp = a.jumlah - b.jumlah;
      } else if (sortKey === "keterangan") {
        cmp = a.keterangan.localeCompare(b.keterangan);
      } else if (sortKey === "source") {
        cmp = a.source.localeCompare(b.source);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sourceFilter, colFilters, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + r.jumlah, 0);
    const avg = filteredRows.length ? total / filteredRows.length : 0;
    const composition: Record<Source, number> = { SALE: 0, TARTUN: 0, SERVER: 0 };
    for (const r of filteredRows) composition[r.source]++;
    return { total, avg, composition };
  }, [filteredRows]);

  const selectedBreakdown = useMemo(() => {
    const counts: Record<Source, number> = { SALE: 0, TARTUN: 0, SERVER: 0 };
    for (const r of rows) if (selected.has(r.id)) counts[r.source]++;
    const parts: string[] = [];
    if (counts.SALE) parts.push(`${counts.SALE} Penjualan`);
    if (counts.TARTUN) parts.push(`${counts.TARTUN} Tarik Tunai`);
    if (counts.SERVER) parts.push(`${counts.SERVER} Komisi Server`);
    return parts.join(", ") || "0 data";
  }, [rows, selected]);

  function exportUrl(): string {
    const params = new URLSearchParams();
    if (!allTime) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return `/api/data-explorer/export?${params.toString()}`;
  }

  async function confirmDelete(row: UnifiedRow) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/data-explorer/${row.source}/${row.sourceId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus data.");
        return;
      }
      setDeletingId(null);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch {
      setDeleteError("Terjadi kesalahan jaringan.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const visibleIds = filteredRows.map((r) => r.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  async function confirmBulkDelete() {
    setBulkBusy(true);
    setDeleteError(null);
    try {
      const items = rows
        .filter((r) => selected.has(r.id))
        .map((r) => ({ source: r.source, id: r.sourceId }));
      const res = await fetch("/api/data-explorer/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus data terpilih.");
        return;
      }
      setRows((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
      setBulkConfirmOpen(false);
    } catch {
      setDeleteError("Terjadi kesalahan jaringan.");
    } finally {
      setBulkBusy(false);
    }
  }

  function SortHeader({ label, sortField }: { label: string; sortField: SortKey }) {
    const active = sortKey === sortField;
    return (
      <th
        onClick={() => toggleSort(sortField)}
        className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase text-muted cursor-pointer select-none hover:text-foreground transition-colors"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={active ? "text-accent" : "text-faint"}>{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Analisa Data</h1>
        <p className="text-xs text-muted mt-0.5">
          Gabungan Data Penjualan, Tarik Tunai, dan Komisi Server dalam satu tabel — bisa difilter dan (untuk master) dihapus.
        </p>
      </div>

      {/* Control Bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted">Dari:</label>
            <input
              type="date"
              value={from}
              disabled={allTime}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted">Sampai:</label>
            <input
              type="date"
              value={to}
              disabled={allTime}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-40"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            Terapkan
          </button>
          <button
            type="button"
            onClick={() => setAllTime((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              allTime ? "bg-accent/10 border-accent/40 text-accent" : "border-border/70 bg-surface text-muted hover:bg-surface-hover"
            }`}
          >
            Semua Waktu
          </button>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as Source | "")}
            className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          >
            <option value="">Semua Jenis</option>
            <option value="SALE">Data Penjualan</option>
            <option value="TARTUN">Data Tarik Tunai</option>
            <option value="SERVER">Data Komisi Server</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {isMaster && selected.size > 0 && (
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              Hapus {formatNumber(selected.size)} Terpilih
            </button>
          )}
          <a
            href={exportUrl()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
            </svg>
            Ekspor CSV
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {deleteError}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Hasil Ditampilkan" value={`${formatNumber(filteredRows.length)} / ${formatNumber(rows.length)}`} />
        <StatCard label="Total Nilai" value={formatRupiah(stats.total)} />
        <StatCard label="Rata-rata Nilai" value={formatRupiah(stats.avg)} />
        <StatCard
          label="Komposisi Jenis"
          value={`${stats.composition.SALE}/${stats.composition.TARTUN}/${stats.composition.SERVER}`}
          hint="Penjualan / Tarik Tunai / Komisi Server"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle/70 border-b border-border/80">
              <tr>
                {isMaster && (
                  <th className="px-3 py-2.5 text-center w-8">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id))}
                      onChange={toggleSelectAllVisible}
                      className="rounded border-border/80"
                      title="Pilih semua yang tampil"
                    />
                  </th>
                )}
                <SortHeader label="Tanggal & Jam" sortField="tanggal" />
                <SortHeader label="Nama Outlet" sortField="outletName" />
                <SortHeader label="Jenis Transaksi" sortField="source" />
                <SortHeader label="Jumlah" sortField="jumlah" />
                <SortHeader label="Keterangan" sortField="keterangan" />
                <th className="px-3 py-2.5 text-center font-semibold text-[11px] uppercase text-muted">Detail</th>
                {isMaster && <th className="px-3 py-2.5 text-center font-semibold text-[11px] uppercase text-muted">Aksi</th>}
              </tr>
              <tr className="bg-surface-subtle/40 border-b border-border/60">
                {isMaster && <th />}
                <th className="px-3 py-1.5">
                  <input
                    value={colFilters.tanggal}
                    onChange={(e) => setColFilters((f) => ({ ...f, tanggal: e.target.value }))}
                    placeholder="Filter..."
                    className="w-full rounded-md border border-border/70 bg-surface px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </th>
                <th className="px-3 py-1.5">
                  <input
                    value={colFilters.outlet}
                    onChange={(e) => setColFilters((f) => ({ ...f, outlet: e.target.value }))}
                    placeholder="Filter..."
                    className="w-full rounded-md border border-border/70 bg-surface px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </th>
                <th className="px-3 py-1.5" />
                <th className="px-3 py-1.5">
                  <input
                    value={colFilters.jumlah}
                    onChange={(e) => setColFilters((f) => ({ ...f, jumlah: e.target.value }))}
                    placeholder="Filter..."
                    className="w-full rounded-md border border-border/70 bg-surface px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </th>
                <th className="px-3 py-1.5">
                  <input
                    value={colFilters.keterangan}
                    onChange={(e) => setColFilters((f) => ({ ...f, keterangan: e.target.value }))}
                    placeholder="Filter..."
                    className="w-full rounded-md border border-border/70 bg-surface px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </th>
                <th />
                {isMaster && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && (
                <tr>
                  <td colSpan={isMaster ? 8 : 6} className="px-4 py-10 text-center text-muted">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={isMaster ? 8 : 6} className="px-4 py-10 text-center text-muted">
                    Tidak ada data yang cocok dengan filter.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredRows.map((r) => (
                  <tr key={r.id} className={`hover:bg-surface-hover/50 transition-colors ${selected.has(r.id) ? "bg-accent/5" : ""}`}>
                    {isMaster && (
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded border-border/80"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 font-mono whitespace-nowrap text-foreground">
                      {r.tanggal}
                      {r.jam && <span className="text-muted">, {r.jam}</span>}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground truncate max-w-48">{r.outletName}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border ${SOURCE_BADGE[r.source]}`}>
                        {SOURCE_LABEL[r.source]}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-foreground whitespace-nowrap">{formatRupiah(r.jumlah)}</td>
                    <td className="px-3 py-2 text-muted truncate max-w-72" title={r.keterangan}>{r.keterangan}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setDetailRow(r)}
                        className="text-muted hover:text-accent transition-colors p-1 rounded hover:bg-accent/10"
                        title="Lihat detail"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </td>
                    {isMaster && (
                      <td className="px-3 py-2 text-center">
                        {deletingId === r.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              disabled={deleteBusy}
                              className="text-[11px] text-muted hover:text-foreground px-2 py-0.5 rounded border border-border/80 hover:bg-surface-hover transition-colors disabled:opacity-40"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(r)}
                              disabled={deleteBusy}
                              className="text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
                            >
                              {deleteBusy ? "Menghapus..." : "Ya, Hapus"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setDeletingId(r.id); setDeleteError(null); }}
                            className="text-muted hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-500/10"
                            title="Hapus"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailRow(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Detail Transaksi</h2>
                <span className={`inline-block mt-1 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border ${SOURCE_BADGE[detailRow.source]}`}>
                  {SOURCE_LABEL[detailRow.source]}
                </span>
              </div>
              <button type="button" onClick={() => setDetailRow(null)} className="text-muted hover:text-foreground">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-1.5 text-xs max-h-96 overflow-y-auto">
              {Object.entries(detailRow.detail).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 py-1 border-b border-border/40">
                  <span className="text-muted font-medium">{key}</span>
                  <span className="text-foreground font-mono text-right">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <ConfirmDeleteModal
        open={bulkConfirmOpen}
        title={`Hapus ${formatNumber(selected.size)} data terpilih?`}
        description={
          <>
            Baris yang dipilih akan dihapus permanen: {selectedBreakdown}. Untuk baris Tarik Tunai/Komisi Server,
            ini menghapus <strong className="text-foreground">total satu hari penuh</strong> outlet tersebut, bukan
            satu transaksi saja. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirmText="HAPUS DATA"
        confirmLabel="Hapus Permanen"
        busy={bulkBusy}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
