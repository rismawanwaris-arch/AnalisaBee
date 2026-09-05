import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "../context/AuthContext";
import type { SystemStatus } from "../lib/queries/systemStatus";
import { FEATURE_KEYS, type FeatureKey } from "../lib/features";

// Longest/most-specific prefix first — "/items/categories" must be checked
// before "/items", and "/cimahi/target" before a hypothetical "/cimahi".
const PATH_FEATURES: [string, FeatureKey][] = [
  ["/cimahi/target", "target_cimahi"],
  ["/items/categories", "item_categories"],
  ["/target", "target_bandung"],
  ["/points", "points"],
  ["/items", "items"],
  ["/outlets", "outlets"],
  ["/employees", "employees"],
  ["/transactions", "transactions"],
  ["/import", "import"],
  ["/log", "activity_log"],
  ["/dashboard", "dashboard"],
];

const FEATURE_PATHS: Record<FeatureKey, string> = {
  dashboard: "/dashboard",
  target_bandung: "/target",
  points: "/points",
  target_cimahi: "/cimahi/target",
  items: "/items",
  item_categories: "/items/categories",
  outlets: "/outlets",
  employees: "/employees",
  transactions: "/transactions",
  import: "/import",
  activity_log: "/log",
};

function featureForPath(pathname: string): FeatureKey | null {
  for (const [prefix, feature] of PATH_FEATURES) {
    if (pathname.startsWith(prefix)) return feature;
  }
  return null;
}

export function AppLayout() {
  const { authenticated, role, canAccess } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    const ctrl = new AbortController();
    fetch("/api/status", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [authenticated]);

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span>Memeriksa sesi pengguna...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  // Guard: settings page hanya untuk master
  if (location.pathname === "/settings" && role !== "master") {
    return <Navigate to="/dashboard" replace />;
  }

  // Guard: fitur lain dibatasi oleh peran kustom (master selalu lolos).
  const requiredFeature = featureForPath(location.pathname);
  if (requiredFeature && !canAccess(requiredFeature)) {
    const fallback = FEATURE_KEYS.find((k) => canAccess(k));
    if (fallback) return <Navigate to={FEATURE_PATHS[fallback]} replace />;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-center p-6">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-semibold text-foreground">Belum ada akses fitur</p>
          <p className="text-xs text-muted leading-relaxed">
            Akun Anda belum diberi akses ke fitur mana pun. Hubungi master untuk mengatur peran akun Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start">
      <Sidebar status={status} />
      <div className="flex-1 flex flex-col min-w-0 self-stretch">
        <Topbar />
        <main className="flex-1 px-4 py-4 md:px-5 md:py-5 max-w-[1680px] w-full space-y-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
