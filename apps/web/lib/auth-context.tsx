"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { setAuthToken, clearAuthToken } from "@/lib/api";

interface User {
  user_id: string;
  email: string;
  full_name?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === "undefined") return { user: null, token: null };
  const storedToken = localStorage.getItem("access_token");
  const storedUser = localStorage.getItem("user");
  if (storedToken && storedUser) {
    try {
      return { user: JSON.parse(storedUser), token: storedToken };
    } catch {
      localStorage.removeItem("user");
      clearAuthToken();
    }
  }
  return { user: null, token: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Both server and first client render: user/token are null (matches SSR).
  // After mount we hydrate from localStorage.
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on first client mount
  useEffect(() => {
    const fresh = readStoredAuth();
    setUser(fresh.user);
    setToken(fresh.token);
    setIsHydrated(true);
  }, []);

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "access_token" || e.key === "user") {
        const fresh = readStoredAuth();
        setUser(fresh.user);
        setToken(fresh.token);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setAuthToken(newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading: !isHydrated, isHydrated, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
