'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginApi, getMeApi } from '../lib/auth/api';
import { saveToken, loadToken, clearToken } from '../lib/auth/storage';
import { decodeJwtPayload, isTokenExpired } from '../lib/auth';
import type { Role } from '../lib/auth/types';

interface AuthContextValue {
  token: string | null;
  staffId: string | null;
  role: Role | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(rawRole: unknown): Role | null {
  if (!rawRole) return null;
  const r = String(rawRole).trim();
  return r.startsWith('ROLE_') ? r.slice(5).toUpperCase() : r.toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = loadToken();
    if (saved) {
      const payload = decodeJwtPayload(saved);
      if (payload && !isTokenExpired(payload)) {
        setToken(saved);
        setStaffId(payload.sub);
        setRole(normalizeRole(payload.role));
      } else {
        clearToken();
      }
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setStaffId(null);
    setRole(null);
    router.push('/');
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginApi({ email, password });
      saveToken(data.token);
      setToken(data.token);
      setStaffId(data.staffId);
      setRole(normalizeRole(data.role));
      router.push('/dashboard');
    },
    [router]
  );

  const value = useMemo(
    () => ({ token, staffId, role, loading, isAuthenticated: Boolean(token), login, logout }),
    [token, staffId, role, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
