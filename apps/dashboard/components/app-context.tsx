'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Org = { id: string; name: string; role: string };

type AppContextValue = {
  apiBase: string;
  token: string;
  setToken: (t: string) => void;
  logout: () => void;
  mounted: boolean;

  orgs: Org[];
  selectedOrgId: string;
  setSelectedOrgId: (id: string) => void;
  reloadOrgs: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

  const [mounted, setMounted] = useState(false);
  const [token, setTokenState] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('auth_token') || '';
  });
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  function setToken(t: string) {
    localStorage.setItem('auth_token', t);
    setTokenState(t);
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setTokenState('');
    setOrgs([]);
    setSelectedOrgId('');
  }

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {}),
        ...authHeader
      }
    });

    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text };
    }

    if (!res.ok) {
      throw new Error(json?.message || json?.error || `Request failed (${res.status})`);
    }
    return json;
  }

  async function reloadOrgs() {
    if (!token) return;
    const data = await apiFetch('/orgs');
    setOrgs(data.orgs || []);
    if (!selectedOrgId && data.orgs?.[0]?.id) setSelectedOrgId(data.orgs[0].id);
  }

  useEffect(() => {
    if (!token) return;
    reloadOrgs().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value: AppContextValue = {
    apiBase,
    token,
    setToken,
    logout,
    mounted,
    orgs,
    selectedOrgId,
    setSelectedOrgId,
    reloadOrgs
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
