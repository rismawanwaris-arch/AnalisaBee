import { Link, useLocation, Outlet } from "react-router-dom";

const TABS = [
  { href: "/points", label: "Leaderboard Pegawai", exact: true },
];

export function PointsLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Poin &amp; Insentif Penjualan</h1>
          <p className="text-xs text-muted mt-0.5">
            Akumulasi poin produk terjual per pegawai untuk penilaian performa dan insentif.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <nav className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-subtle border border-border/80 shadow-2xs">
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
          <a
            href="/papan-poin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-all shadow-2xs"
            title="Buka papan poin publik (tanpa login) di tab baru"
          >
            Papan Poin
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
