import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";

interface ForgotPasswordPageProps {
  initialMode?: "request" | "redeem";
}

export function ForgotPasswordPage({ initialMode = "request" }: ForgotPasswordPageProps) {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code")?.trim() ?? "";
  const initialUsername = searchParams.get("u")?.trim() ?? "";

  const [mode, setMode] = useState<"request" | "redeem">(initialCode ? "redeem" : initialMode);
  const [username, setUsername] = useState(initialUsername);
  const [note, setNote] = useState("");
  const [code, setCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  function switchMode(next: "request" | "redeem") {
    setMode(next);
    setError(null);
    setRequestNotice(null);
    setRedeemSuccess(false);
  }

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRequestNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal mengirim permintaan reset kata sandi.");
        return;
      }
      setRequestNotice(
        data.message ||
          "Permintaan telah dicatat. Jika username terdaftar dan aktif, hubungi pemilik akun master untuk mendapatkan kode reset.",
      );
      setNote("");
    } catch {
      setError("Terjadi kesalahan jaringan. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeemSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRedeemSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal mereset kata sandi.");
        return;
      }
      setRedeemSuccess(true);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Terjadi kesalahan jaringan. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-blue-600/15 via-indigo-600/10 to-sky-400/15 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-xl p-7 shadow-xl shadow-black/5 space-y-5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 text-white shadow-md shadow-blue-500/25 grid place-items-center text-lg font-black tracking-wider mb-1">
              BE
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Pemulihan Akun <span className="text-accent">AnalisaBEe</span>
            </h1>
            <p className="text-xs text-muted leading-relaxed">
              {mode === "request"
                ? "Ajukan permintaan reset ke pemilik akun master, lalu buat kata sandi baru menggunakan kode yang diberikan."
                : "Masukkan kode reset dari master atau kode pemulihan darurat master untuk membuat kata sandi baru."}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-surface-subtle p-1 border border-border/60">
            <button
              type="button"
              onClick={() => switchMode("request")}
              className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                mode === "request"
                  ? "bg-surface text-foreground shadow-xs border border-border/60"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Ajukan Reset
            </button>
            <button
              type="button"
              onClick={() => switchMode("redeem")}
              className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                mode === "redeem"
                  ? "bg-surface text-foreground shadow-xs border border-border/60"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Punya Kode Reset
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {mode === "request" ? (
            requestNotice ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed space-y-1.5">
                  <div className="font-semibold">Permintaan Reset Dicatat</div>
                  <p>{requestNotice}</p>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode("redeem")}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent-hover transition-all"
                >
                  Sudah dapat kode? Masukkan Kode Reset →
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-username" className="block text-xs font-semibold text-foreground mb-1.5">
                    Username
                  </label>
                  <input
                    id="forgot-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username akun Anda"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="forgot-note" className="block text-xs font-semibold text-foreground mb-1.5">
                    Catatan untuk Master <span className="font-normal text-muted">(opsional)</span>
                  </label>
                  <input
                    id="forgot-note"
                    name="note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Mis. Lupa kata sandi - Outlet Padasuka"
                    maxLength={200}
                    className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-60 shadow-sm shadow-blue-500/20"
                >
                  {loading ? "Mengirim..." : "Kirim Permintaan Reset"}
                </button>
              </form>
            )
          ) : redeemSuccess ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed space-y-1.5">
                <div className="font-semibold">Kata Sandi Berhasil Diperbarui</div>
                <p>
                  Kata sandi baru Anda sudah aktif dan seluruh sesi login lama telah diakhiri. Silakan masuk kembali menggunakan kata sandi baru.
                </p>
              </div>
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent-hover transition-all"
              >
                Masuk ke Dashboard
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRedeemSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="reset-username" className="block text-xs font-semibold text-foreground mb-1.5">
                  Username
                </label>
                <input
                  id="reset-username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                />
              </div>

              <div>
                <label htmlFor="reset-code" className="block text-xs font-semibold text-foreground mb-1.5">
                  Kode Reset / Kode Pemulihan
                </label>
                <input
                  id="reset-code"
                  name="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  required
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm font-mono tracking-wider uppercase text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                />
              </div>

              <div>
                <label htmlFor="reset-new-password" className="block text-xs font-semibold text-foreground mb-1.5">
                  Kata Sandi Baru
                </label>
                <input
                  id="reset-new-password"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 10 karakter (huruf & angka)"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                />
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-foreground mb-1.5">
                  Konfirmasi Kata Sandi Baru
                </label>
                <input
                  id="reset-confirm-password"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-60 shadow-sm shadow-blue-500/20"
              >
                {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
            <Link to="/login" className="font-medium text-muted hover:text-foreground transition-colors">
              ← Kembali ke Login
            </Link>
            {mode === "request" && !requestNotice && (
              <button
                type="button"
                onClick={() => switchMode("redeem")}
                className="font-medium text-accent hover:underline"
              >
                Sudah punya kode?
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted/70 mt-5 font-mono">
          AnalisaBEe · React SPA & Prisma
        </p>
      </div>
    </div>
  );
}
