import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import type { SystemStatus } from "@/lib/queries/systemStatus";

interface NavGroup {
  group?: string;
  items: {
    href: string;
    label: string;
    icon: ReactNode;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Ringkasan",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: (
          <path d="M3 13.2h7.2V3H3v10.2Zm0 7.8h7.2v-5.4H3V21Zm10.8 0H21V10.8h-7.2V21Zm0-18v5.4H21V3h-7.2Z" />
        ),
      },
      {
        href: "/target",
        label: "Target Harian",
        icon: (
          <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </>
        ),
      },
      {
        href: "/points",
        label: "Poin Penjualan",
        icon: <path d="M12 2.5 14.6 9h6.4l-5.2 4 2 6.5L12 15.8 6.2 19.5l2-6.5-5.2-4h6.4Z" />,
      },
    ],
  },
  {
    group: "Dimensi Analisis",
    items: [
      {
        href: "/items",
        label: "Item & SKU",
        icon: <path d="M4 7h16M4 12h16M4 17h10" />,
      },
      {
        href: "/items/categories",
        label: "Kategori Item",
        icon: (
          <>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 17.5h7M17.5 14v7" />
          </>
        ),
      },
      {
        href: "/outlets",
        label: "Performa Outlet",
        icon: <path d="M3 9.5 12 3l9 6.5M5 9v11h14V9M9 20v-6h6v6" />,
      },
      {
        href: "/employees",
        label: "Pegawai & Staff",
        icon: (
          <>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
          </>
        ),
      },
      {
        href: "/transactions",
        label: "Daftar Transaksi",
        icon: (
          <>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M4 10h16M9 10v10" />
          </>
        ),
      },
    ],
  },
  {
    group: "Manajemen Data & Sistem",
    items: [
      {
        href: "/import",
        label: "Import & Batch",
        icon: <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />,
      },
      {
        href: "/settings",
        label: "Pengaturan",
        icon: (
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </>
        ),
      },
    ],
  },
];

export function Sidebar({ status }: { status: SystemStatus | null }) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 sticky top-0 h-screen z-40 border-r border-border/80 bg-surface-sidebar select-none">
      {/* Brand Header */}
      <div className="h-15 flex items-center justify-between px-4 border-b border-border/70">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 text-white shadow-sm shadow-blue-500/25 grid place-items-center text-xs font-black tracking-wider transition-transform group-hover:scale-105">
            BE
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-sm text-foreground leading-none">
              Analisa<span className="text-accent">BEe</span>
            </span>
            <span className="text-[10px] text-muted tracking-wide mt-0.5 font-medium">
              Retail Intelligence
            </span>
          </div>
        </Link>
        <span className="text-[10px] font-mono text-faint bg-surface-subtle border border-border/80 rounded-md px-1.5 py-0.5 font-medium">
          React SPA
        </span>
      </div>

      {/* Live Operational Status Widget */}
      <div className="px-3.5 py-3 border-b border-border/60 bg-surface-subtle/50">
        <div className="rounded-lg border border-border/70 bg-surface p-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-foreground">
                {status ? `${status.outletCount} Outlet` : "Memuat..."}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted font-medium">
              {status ? `${formatNumber(status.saleRowCount)} baris` : ""}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-muted truncate">
            {status?.lastImportFilename ? (
              <span title={status.lastImportFilename}>
                File: <span className="font-medium text-foreground">{status.lastImportFilename}</span>
              </span>
            ) : (
              "Live Retail System"
            )}
          </div>
        </div>
      </div>

      {/* Navigation Links with Group Headers */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.group && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                {group.group}
              </div>
            )}
            {group.items.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname === "/"
                  : pathname?.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                    active
                      ? "bg-accent/10 text-accent font-semibold shadow-xs"
                      : "text-muted hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 transition-colors ${
                      active ? "text-accent stroke-[2.2]" : "text-muted group-hover:text-foreground"
                    }`}
                  >
                    {link.icon}
                  </svg>
                  <span className="truncate">{link.label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / System Meta */}
      <div className="px-4 py-3 border-t border-border/70 text-[11px] text-muted flex items-center justify-between">
        <span className="font-medium text-foreground/80">AnalisaBEe Dashboard</span>
        <span className="font-mono text-[10px] text-faint">React 19 · Vite</span>
      </div>
    </aside>
  );
}
