import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "../context/AuthContext";
import type { SystemStatus } from "../lib/queries/systemStatus";

export function AppLayout() {
  const { authenticated, role } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    if (authenticated) {
      fetch("/api/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setStatus(data);
        })
        .catch(() => {});
    }
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
  if (location.pathname === "/settings" && role === "admin") {
    return <Navigate to="/dashboard" replace />;
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
