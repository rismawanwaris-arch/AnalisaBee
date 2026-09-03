import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

const TITLES: { prefix: string; label: string; section?: string }[] = [
  { prefix: "/dashboard", label: "Ringkasan Penjualan", section: "Dashboard" },
  { prefix: "/target", label: "Target Harian", section: "Laporan" },
  { prefix: "/points", label: "Poin Penjualan", section: "Insentif" },
  { prefix: "/items", label: "Item & SKU", section: "Master Data" },
  { prefix: "/outlets", label: "Performa Outlet", section: "Cabang" },
  { prefix: "/employees", label: "Performa Pegawai", section: "Staff" },
  { prefix: "/transactions", label: "Data Penjualan", section: "Audit" },
  { prefix: "/import", label: "Data Management & Ingestion", section: "Sistem" },
];

const MOBILE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/target", label: "Target" },
  { href: "/points", label: "Poin" },
  { href: "/items", label: "Item" },
  { href: "/outlets", label: "Outlet" },
  { href: "/employees", label: "Pegawai" },
  { href: "/transactions", label: "Data" },
  { href: "/import", label: "Import" },
];

export function Topbar() {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { logout } = useAuth();

  const current = TITLES.find((t) => pathname.startsWith(t.prefix)) ?? {
    label: "AnalisaBEe",
    section: "Analisa",
  };

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border/80 shadow-xs">
      <div className="h-14 flex items-center justify-between px-4 md:px-6 gap-4">
        {/* Left: Breadcrumbs / Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to="/dashboard" className="md:hidden flex items-center gap-2 mr-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center text-[10px] font-bold">
              BE
            </div>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="hidden sm:inline font-medium text-muted/70">{current.section}</span>
            <span className="hidden sm:inline text-muted/40">/</span>
            <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">
              {current.label}
            </h1>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground bg-surface-subtle/80 hover:bg-surface-hover border border-border/80 hover:border-border rounded-lg px-2.5 py-1.5 transition-all shadow-xs"
            title="Keluar dari akun"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Navigation Tabs */}
      <nav className="md:hidden flex gap-1.5 overflow-x-auto px-4 pb-2.5 pt-1 no-scrollbar border-t border-border/40">
        {MOBILE_LINKS.map((l) => {
          const active =
            l.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              to={l.href}
              className={`px-3 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                active
                  ? "bg-accent text-accent-foreground font-medium shadow-xs"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
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
