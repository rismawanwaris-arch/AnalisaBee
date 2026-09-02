"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const TITLES: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/items", label: "Item" },
  { prefix: "/outlets", label: "Outlet" },
  { prefix: "/employees", label: "Pegawai" },
  { prefix: "/transactions", label: "Data Penjualan" },
  { prefix: "/target", label: "Target Harian" },
  { prefix: "/points", label: "Poin Penjualan" },
  { prefix: "/import", label: "Data Management" },
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
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
      <div className="h-16 flex items-center justify-between px-4 md:px-8">
        <div>
          <span className="md:hidden font-semibold tracking-tight mr-3">
            Analisa<span className="text-accent">BEe</span>
          </span>
          <span className="text-sm font-medium text-muted hidden md:inline">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="text-sm text-muted hover:text-foreground"
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
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${
                active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-hover"
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
