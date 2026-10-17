import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatRupiah } from "@/lib/format";
import { EmployeeSoldItemsTable, type SoldItemRow } from "./EmployeeSoldItemsTable";

interface EmployeeDetailResponse {
  employee: { id: number; name: string };
  totals: {
    qty: number;
    subtotal: number;
    labaRugi: number;
    transactionCount: number;
  };
  items: SoldItemRow[];
  byOutlet: { outletId: number; outletName: string; qty: number; subtotal: number }[];
  trend: { tanggal: string; qty: number; subtotal: number }[];
}

interface EmployeeSoldItemsModalProps {
  employeeId: number;
  employeeName: string;
  filterQuery: string;
  filterLabels: string[];
  onClose: () => void;
}

export function EmployeeSoldItemsModal({
  employeeId,
  employeeName,
  filterQuery,
  filterLabels,
  onClose,
}: EmployeeSoldItemsModalProps) {
  const [data, setData] = useState<EmployeeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/employees/${employeeId}${filterQuery}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [employeeId, filterQuery]);

  const detailUrl = `/employees/${employeeId}${filterQuery}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl border border-border/80 bg-surface shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-border/80 bg-surface-subtle/30 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Barang Terjual: {data?.employee.name || employeeName}
              </h2>
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Menampilkan rincian barang yang berhasil dijual oleh pegawai ini sesuai filter yang aktif.
            </p>
            {filterLabels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] uppercase font-bold text-muted/70 tracking-wider">Filter Aktif:</span>
                {filterLabels.map((label, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-subtle border border-border/70 text-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={detailUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle hover:bg-surface-hover border border-border/80 text-foreground transition-colors"
              title="Buka halaman analitik lengkap pegawai ini"
            >
              <span>Halaman Lengkap</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-colors"
              title="Tutup (Esc)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
              <span className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-xs font-medium">Memuat daftar barang yang dijual...</span>
            </div>
          ) : !data ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-12 text-center text-xs text-muted">
              Data penjualan pegawai tidak ditemukan.
            </div>
          ) : (
            <>
              {/* Stat Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Jenis Barang</span>
                  <p className="text-base font-bold text-foreground mt-0.5 font-mono">
                    {formatNumber(data.items.length)} item
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Qty Terjual</span>
                  <p className="text-base font-bold text-foreground mt-0.5 font-mono">
                    {formatNumber(data.totals.qty)} pcs
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Omzet</span>
                  <p className="text-base font-bold text-foreground mt-0.5 font-mono">
                    {formatRupiah(data.totals.subtotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Laba</span>
                  <p className="text-base font-bold text-foreground mt-0.5 font-mono">
                    {formatRupiah(data.totals.labaRugi)}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <EmployeeSoldItemsTable items={data.items} maxHeight="max-h-[52vh]" />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/80 bg-surface-subtle/30 flex items-center justify-between text-xs text-muted shrink-0">
          <span>Tekan <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border/80 rounded">Esc</kbd> untuk menutup</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle hover:bg-surface-hover border border-border/80 text-foreground transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
