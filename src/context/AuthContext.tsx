import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "master" | null;

interface AuthContextType {
  authenticated: boolean | null; // null = checking
  role: UserRole;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: null,
  role: null,
  checkAuth: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [role, setRole] = useState<UserRole>(null);

  const checkAuth = async (retries = 3): Promise<boolean> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          const authed = data.authenticated === true;
          setAuthenticated(authed);
          setRole(authed ? (data.role as UserRole) : null);
          return authed;
        }
        // 4xx = server up but auth failed — no retry needed
        setAuthenticated(false);
        setRole(null);
        return false;
      } catch {
        // Network error = server probably still starting up, retry
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }
    setAuthenticated(false);
    setRole(null);
    return false;
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAuthenticated(false);
      setRole(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ authenticated, role, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
