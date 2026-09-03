import { Link, useLocation, Outlet } from "react-router-dom";

const TABS = [
  { href: "/target", label: "Laporan Harian", exact: true },
  { href: "/target/analitik", label: "Analitik Eksekutif" },
  { href: "/target/jam-operasional", label: "Jam Operasional" },
];

export function TargetLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Target Penjualan Harian</h1>
          <p className="text-xs text-muted mt-0.5">
            Pencapaian target Server, Tartun, Petshop, Aksesoris &amp; SP/Voucher per outlet.
          </p>
        </div>
        <nav className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-subtle border border-border/80 shadow-2xs shrink-0">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  active
                    ? "bg-surface text-foreground font-semibold shadow-xs border border-border/60"
                    : "text-muted hover:text-foreground font-medium"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
