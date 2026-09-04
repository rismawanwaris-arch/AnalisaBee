import { useCallback, useEffect, useState } from "react";

interface LogEntry {
  id: number;
  role: string;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  OUTLET_VISIBILITY: "Visibilitas Outlet",
  EMPLOYEE_VISIBILITY: "Visibilitas Pegawai",
  TARGET_UPDATE: "Update Target",
  PERIOD_UPDATE: "Update Siklus",
  ITEM_RULE_ADD: "Tambah Aturan Item",
  ITEM_RULE_DELETE: "Hapus Aturan Item",
  ITEM_EXCLUSION_ADD: "Kecualikan Item",
  ITEM_EXCLUSION_DELETE: "Sertakan Lagi Item",
  GROUP_DEFAULT_ADD: "Tambah Default Grup",
  GROUP_DEFAULT_DELETE: "Hapus Default Grup",
  GROUP_MAPPING_ADD: "Tambah Mapping Grup",
  GROUP_MAPPING_DELETE: "Hapus Mapping Grup",
  ALIAS_ADD: "Tambah Alias Outlet",
  ALIAS_DELETE: "Hapus Alias Outlet",
  EMPLOYEE_EXCLUSION_ADD: "Kecualikan Pegawai",
  EMPLOYEE_EXCLUSION_DELETE: "Sertakan Lagi Pegawai",
  IMPORT_SALES: "Import Data Sales",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (roleFilter) params.set("role", roleFilter);
      if (fromFilter) params.set("from", fromFilter);
      if (toFilter) params.set("to", toFilter);
      const res = await fetch(`/api/activity-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [roleFilter, fromFilter, toFilter, page]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">Log Aktivitas</h1>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Riwayat seluruh aktivitas yang dilakukan oleh admin maupun master — login, perubahan pengaturan, dan impor data.
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            >
              <option value="">Semua role</option>
              <option value="master">Master</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Dari Tanggal</label>
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => { setFromFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Sampai Tanggal</label>
            <input
              type="date"
              value={toFilter}
              onChange={(e) => { setToFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
          {(roleFilter || fromFilter || toFilter) && (
            <button
              type="button"
              onClick={() => { setRoleFilter(""); setFromFilter(""); setToFilter(""); setPage(0); }}
              className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted hover:text-rose-500 hover:border-rose-500/30 transition-colors"
            >
              ↺ Reset
            </button>
          )}
          <span className="text-[11px] text-muted ml-auto self-end pb-0.5">
            {total.toLocaleString("id-ID")} entri
          </span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted font-medium py-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memuat log aktivitas...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted">
          Tidak ada aktivitas yang tercatat.
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle/80 text-muted text-left border-b border-border/80">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase whitespace-nowrap">Waktu</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Role</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Aksi</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Detail</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                        log.role === "master"
                          ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20"
                      }`}>
                        {log.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </td>
                    <td className="px-4 py-2.5 text-muted max-w-xs truncate" title={log.detail ?? ""}>
                      {log.detail ?? <span className="text-faint">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-muted whitespace-nowrap">
                      {log.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between text-xs text-muted">
              <span>
                Halaman {page + 1} dari {totalPages} · {total.toLocaleString("id-ID")} total entri
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1 text-[11px] font-medium hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-2.5 py-1 text-[11px] font-medium hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
