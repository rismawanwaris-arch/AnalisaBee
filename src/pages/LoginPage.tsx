import React, { useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";

export function LoginPage() {
  const { authenticated, checkAuth } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawFrom = searchParams.get("from") ?? "";
  const from = /^\/(?!\/)/.test(rawFrom) ? rawFrom : "/dashboard";

  if (authenticated === true) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Wrong password or other server error — don't retry
          setError(data.error || "Gagal masuk.");
          setLoading(false);
          return;
        }
        await checkAuth();
        navigate(from, { replace: true });
        return;
      } catch (err) {
        // Network error (server still starting) — retry after short delay
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    setError("Terjadi kesalahan jaringan. Pastikan server berjalan.");
    setLoading(false);
    void lastError;
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-blue-600/15 via-indigo-600/10 to-sky-400/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top action: Theme switch */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand Card */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-xl p-7 shadow-xl shadow-black/5 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 text-white shadow-md shadow-blue-500/25 grid place-items-center text-lg font-black tracking-wider mb-1">
              BE
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Analisa<span className="text-accent">BEe</span>
            </h1>
            <p className="text-xs text-muted leading-relaxed">
              Platform intelijen dan analisis penjualan ritel multi-outlet. Masukkan kata sandi untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-foreground mb-1.5">
                Kata Sandi Aplikasi
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                autoFocus
                required
                className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-60 shadow-sm shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <span>Masuk ke Dashboard</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-muted/70 mt-5 font-mono">
          AnalisaBEe · React SPA & Prisma
        </p>
      </div>
    </div>
  );
}
