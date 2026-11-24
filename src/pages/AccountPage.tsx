import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AccountPage() {
  const { username, role, userId } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const hasMinLength = newPassword.length >= 10;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const policyMet = hasMinLength && hasLetter && hasDigit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Kata sandi baru harus berbeda dari kata sandi saat ini.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal mengubah kata sandi.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessNotice(
        "Kata sandi berhasil diperbarui. Semua sesi login di perangkat lain telah otomatis diakhiri.",
      );
    } catch {
      setError("Terjadi kesalahan jaringan. Pastikan server berjalan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Pengaturan Akun</h1>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Kelola keamanan akun Anda sendiri dan perbarui kata sandi secara berkala.
        </p>
      </div>

      {/* Account Summary Card */}
      <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 text-accent grid place-items-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted">Masuk sebagai</div>
            <div className="text-sm font-bold text-foreground truncate">
              @{username ?? "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {role && (
            <span
              className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full border ${
                role === "master"
                  ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
                  : "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30"
              }`}
            >
              {role.toUpperCase()}
            </span>
          )}
          {role === "master" && (
            <Link
              to="/settings"
              className="rounded-lg border border-border/70 bg-surface-subtle px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-hover transition-colors"
            >
              Pengaturan Sistem →
            </Link>
          )}
        </div>
      </div>

      {/* Change Password Form Card */}
      <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-foreground">Ubah Kata Sandi</h2>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Mengubah kata sandi menjaga sesi Anda di browser ini tetap aktif, sambil mengeluarkan semua sesi login lain secara otomatis.
            </p>
          </div>
          {userId !== null && (
            <button
              type="button"
              onClick={() => setShowPasswords((prev) => !prev)}
              className="rounded-lg border border-border/70 bg-surface-subtle px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              {showPasswords ? "Sembunyikan Sandi" : "Tampilkan Sandi"}
            </button>
          )}
        </div>

        {userId === null ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Sesi ini menggunakan kata sandi darurat dari file <code className="font-mono">.env</code>, bukan akun database. Untuk mengganti kata sandi tersebut, perbarui konfigurasi <code className="font-mono">.env</code> di server.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
            {successNotice && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {successNotice}
              </div>
            )}

            <div>
              <label htmlFor="account-current-password" className="block text-xs font-semibold text-foreground mb-1.5">
                Kata Sandi Saat Ini
              </label>
              <input
                id="account-current-password"
                name="currentPassword"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan kata sandi Anda saat ini"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="account-new-password" className="block text-xs font-semibold text-foreground mb-1.5">
                  Kata Sandi Baru
                </label>
                <input
                  id="account-new-password"
                  name="newPassword"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 10 karakter"
                  required
                  minLength={10}
                  maxLength={200}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                />
              </div>

              <div>
                <label htmlFor="account-confirm-password" className="block text-xs font-semibold text-foreground mb-1.5">
                  Konfirmasi Kata Sandi Baru
                </label>
                <input
                  id="account-confirm-password"
                  name="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  required
                  minLength={10}
                  maxLength={200}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-all"
                />
              </div>
            </div>

            {/* Password Policy Checklist */}
            <div className="flex items-center gap-3 flex-wrap text-[11px]">
              <span className={hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted"}>
                {hasMinLength ? "✓" : "○"} Minimal 10 karakter
              </span>
              <span className={hasLetter ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted"}>
                {hasLetter ? "✓" : "○"} Mengandung huruf
              </span>
              <span className={hasDigit ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted"}>
                {hasDigit ? "✓" : "○"} Mengandung angka
              </span>
            </div>

            <div className="pt-1 flex items-center justify-end">
              <button
                type="submit"
                disabled={busy || !currentPassword || !policyMet || !confirmPassword}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-50 shadow-xs"
              >
                {busy ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
