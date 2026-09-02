"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/points", label: "Leaderboard", exact: true },
  { href: "/points/pengaturan", label: "Pengaturan Poin" },
];

export default function PointsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-bold text-foreground">Poin Penjualan</h1>
        <p className="text-sm text-muted mt-1">
          Poin per item terjual, diakumulasi per pegawai setiap bulan.
        </p>
      </div>
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? "border-accent text-foreground font-medium"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
