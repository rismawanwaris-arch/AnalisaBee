"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const TITLES: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "Ringkasan Penjualan" },
  { prefix: "/items", label: "Item & SKU" },
  { prefix: "/outlets", label: "Matrix Outlet" },
  { prefix: "/employees", label: "Performa Pegawai" },
  { prefix: "/transactions", label: "Data Penjualan" },
  { prefix: "/target", label: "Target Harian" },
  { prefix: "/points", label: "Poin Penjualan" },
  { prefix: "/import", label: "Data Ingestion" },
];

const MOBILE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/items", label: "Item" },
  { href: "/outlets", label: "Outlet" },
  { href: "/employees", label: "Pegawai" },
  { href: "/transactions", label: "Data" },
  { href: "/target", label: "Target" },
  { href: "/points", label: "Poin" },
  { href: "/import", label: "Import" },
];

export function Topbar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const title = TITLES.find((t) => pathname.startsWith(t.prefix))?.label ?? "AnalisaBEe";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
      <div className="h-13 flex items-center justify-between px-4 md:px-5 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="md:hidden font-semibold tracking-tight text-sm mr-1">
            Analisa<span className="text-accent">BEe</span>
          </span>
          <h1 className="text-xs font-semibold text-foreground truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="text-[11px] font-medium text-muted hover:text-foreground border border-border hover:border-border-subtle rounded px-2 py-1 transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>
      <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-2">
        {MOBILE_LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-2 py-1 rounded text-[11px] whitespace-nowrap border ${
                active
                  ? "bg-surface-active text-foreground border-border-subtle font-medium"
                  : "text-muted border-transparent hover:bg-surface-hover"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
