import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FeatureKey } from "@/lib/features";

export type UserRole = "admin" | "master" | null;
/** "all" for master (and legacy admin accounts with no custom role assigned);
 *  an explicit list for an account restricted to a custom role. */
export type Permissions = "all" | FeatureKey[];

interface AuthContextType {
  authenticated: boolean | null; // null = checking
  role: UserRole;
  username: string | null;
  userId: number | null;
  permissions: Permissions;
  canAccess: (key: FeatureKey) => boolean;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: null,
  role: null,
  username: null,
  userId: null,
  permissions: "all",
  canAccess: () => false,
  checkAuth: async () => false,
  logout: async () => {},
});

// How often to re-check the session while the tab is open. A session revoked
// by a master should drop the browser out of the app without waiting for the
// user to happen to trigger an API call.
const REVALIDATE_INTERVAL_MS = 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Permissions>("all");

  const clearSession = useCallback(() => {
    setAuthenticated(false);
    setRole(null);
    setUsername(null);
    setUserId(null);
    setPermissions("all");
  }, []);

  const checkAuth = useCallback(async (retries = 3): Promise<boolean> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          const authed = data.authenticated === true;
          setAuthenticated(authed);
          setRole(authed ? (data.role as UserRole) : null);
          setUsername(authed ? (data.username ?? null) : null);
          setUserId(authed ? (data.userId ?? null) : null);
          setPermissions(authed ? (data.permissions ?? "all") : "all");
          return authed;
        }
        clearSession();
        return false;
      } catch {
        // Network error = server probably still starting up, retry
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }
    clearSession();
    return false;
  }, [clearSession]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // Keep the latest clearSession in a ref so the fetch patch below can be
  // installed once without going stale.
  const clearSessionRef = useRef(clearSession);
  clearSessionRef.current = clearSession;

  // A revoked session keeps a valid-looking cookie, so the only signal the
  // browser gets is a 401 on the next API call. Catch it in one place instead
  // of at every call site.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url ?? "";
        // A rejected login attempt is also a 401 — that one is not a lost session.
        if (url.includes("/api/") && !url.includes("/api/auth/login")) {
          clearSessionRef.current();
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authenticated !== true) return;
    const id = setInterval(() => {
      fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.authenticated !== true) {
            clearSession();
            return;
          }
          setPermissions(data.permissions ?? "all");
        })
        .catch(() => {});
    }, REVALIDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authenticated, clearSession]);

  const canAccess = useCallback(
    (key: FeatureKey) => role === "master" || permissions === "all" || permissions.includes(key),
    [role, permissions],
  );

  return (
    <AuthContext.Provider
      value={{ authenticated, role, username, userId, permissions, canAccess, checkAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
