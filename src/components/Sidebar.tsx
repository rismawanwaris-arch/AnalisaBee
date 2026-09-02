"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import type { SystemStatus } from "@/lib/queries/systemStatus";

const LINKS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" />,
  },
  {
    href: "/items",
    label: "Item",
    icon: <path d="M4 7h16M4 12h16M4 17h10" />,
  },
  {
    href: "/outlets",
    label: "Outlet",
    icon: <path d="M3 9.5 12 3l9 6.5M5 9v11h14V9M9 20v-6h6v6" />,
  },
  {
    href: "/employees",
    label: "Pegawai",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      </>
    ),
  },
  {
    href: "/transactions",
    label: "Data Penjualan",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16M9 10v10" />
      </>
    ),
  },
  {
    href: "/target",
    label: "Target Harian",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/points",
    label: "Poin Penjualan",
    icon: <path d="M12 2.5 14.6 9h6.4l-5.2 4 2 6.5L12 15.8 6.2 19.5l2-6.5-5.2-4h6.4Z" />,
  },
  {
    href: "/import",
    label: "Data Management",
    icon: <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />,
  },
];

export function Sidebar({ status }: { status: SystemStatus }) {
  const pathname = usePathname();

  // Sticky inside a flex row rather than `fixed`: the sidebar still stays put
  // while the page scrolls, but it occupies a real 240px column, so content can
  // never slide underneath it — not on horizontal overflow, and not during the
  // unstyled frame of a dev-server stylesheet swap.
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 sticky top-0 h-screen z-40 border-r border-border bg-surface-sidebar">
      <div className="h-13 flex items-center gap-2.5 px-4 border-b border-border">
        <span className="w-6 h-6 rounded bg-accent text-accent-foreground grid place-items-center text-[11px] font-bold shrink-0">
          BE
        </span>
        <span className="font-semibold tracking-tight text-[13px] leading-none">
          Analisa<span className="text-accent">BEe</span>
        </span>
        <span className="ml-auto text-[10px] font-mono text-faint border border-border rounded px-1 py-0.5">
          v2.0
        </span>
      </div>

      <div className="px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse shrink-0" />
          <span className="text-[11px] font-medium text-foreground">
            {status.outletCount} Outlet Terdata
          </span>
        </div>
        <div className="mt-1 text-[10px] font-mono text-faint truncate">
          {formatNumber(status.saleRowCount)} baris ·{" "}
          {status.lastImportFilename ?? "belum ada import"}
        </div>
      </div>

      <nav className="flex-1 px-2 py-2.5 space-y-0.5 overflow-y-auto">
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs transition-colors border ${
                active
                  ? "bg-surface-active text-foreground font-semibold border-border-subtle"
                  : "text-muted border-transparent hover:bg-surface-hover hover:text-foreground"
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
                className="shrink-0"
              >
                {link.icon}
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-2.5 border-t border-border text-[10px] font-mono text-faint">
        Retail Analytics · 2.0
      </div>
    </aside>
  );
}
