'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { NotHydratedHint } from './not-hydrated';

type Org = { id: string; name: string; role: string };
type Site = {
  id: string;
  org_id: string;
  type: string;
  status: string;
  name: string;
  slug: string;
  industry: string | null;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  const [token, setToken] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [showPassword, setShowPassword] = useState(false);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [sites, setSites] = useState<Site[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const [newSiteOpen, setNewSiteOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteSlug, setNewSiteSlug] = useState('');

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('auth_token');
    if (t) setToken(t);
  }, []);

  async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {}),
        ...(token ? authHeader : {})
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

  async function loadOrgs() {
    const data = await apiFetch('/orgs');
    setOrgs(data.orgs);
    if (!selectedOrgId && data.orgs?.[0]?.id) setSelectedOrgId(data.orgs[0].id);
  }

  async function loadSites(orgId: string) {
    const data = await apiFetch(`/orgs/${orgId}/sites`);
    setSites(data.sites);
  }

  useEffect(() => {
    if (!token) return;
    loadOrgs().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !selectedOrgId) return;
    loadSites(selectedOrgId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedOrgId]);

  async function handleAuth() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const data = await apiFetch('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, orgName })
        });
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        return;
      }

      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function createSite() {
    setError('');
    setBusy(true);
    try {
      await apiFetch(`/orgs/${selectedOrgId}/sites`, {
        method: 'POST',
        body: JSON.stringify({ name: newSiteName, slug: newSiteSlug, type: 'standard_site' })
      });
      setNewSiteOpen(false);
      setNewSiteName('');
      setNewSiteSlug('');
      await loadSites(selectedOrgId);
    } catch (e: any) {
      setError(e?.message || 'Failed to create site');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setToken('');
    setOrgs([]);
    setSites([]);
    setSelectedOrgId('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-border bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Friendly Web Platform</div>
            <div className="text-xs text-slate-500">
              API: <span className="font-mono">{api}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={
                'rounded-full px-2 py-1 text-[11px] ' +
                (mounted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')
              }
              title={mounted ? 'Client JS is running' : 'If this stays yellow, the page did not hydrate'}
            >
              {mounted ? 'Live' : 'Loading'}
            </div>
            {token ? (
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {error ? (
          <div className="mb-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertTitle>Action needed</AlertTitle>
              <AlertDescription>
                {error}
                {error.toLowerCase().includes('jwt_secret') ? (
                  <div className="mt-2 text-slate-700">
                    In Render, set <span className="font-mono">JWT_SECRET</span> on <strong>friendly-api</strong> and{' '}
                    <strong>friendly-worker</strong>, then redeploy.
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {!token ? (
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</CardTitle>
                <CardDescription>
                  {mode === 'signup'
                    ? 'Create an org and your first site in minutes.'
                    : 'Log in to manage your organizations and sites.'}
                </CardDescription>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant={mode === 'signup' ? 'default' : 'outline'} onClick={() => setMode('signup')}>
                    Sign up
                  </Button>
                  <Button variant={mode === 'login' ? 'default' : 'outline'} onClick={() => setMode('login')}>
                    Log in
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        placeholder="Minimum 8 characters"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-100"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {mode === 'signup' ? (
                    <div className="grid gap-2">
                      <Label htmlFor="org">Organization name</Label>
                      <Input
                        id="org"
                        placeholder="Friendly Rental"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                      />
                    </div>
                  ) : null}

                  <Button onClick={handleAuth} disabled={busy}>
                    {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
                  </Button>

                  <div className="text-xs text-slate-500">
                    Tip: make sure <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> points at your real API
                    URL.
                  </div>

                  <NotHydratedHint />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-600">Organization</div>
                <select
                  className="h-10 rounded-lg border border-border bg-white px-3 text-sm"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.role})
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={() => {
                  setNewSiteOpen(true);
                  setNewSiteName('');
                  setNewSiteSlug('');
                }}
                disabled={!selectedOrgId}
              >
                <Plus size={16} className="mr-2" /> New site
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Sites</CardTitle>
                <CardDescription>These are the sites under the selected organization.</CardDescription>
              </CardHeader>
              <CardContent>
                {sites.length === 0 ? (
                  <div className="text-sm text-slate-600">No sites yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {sites.map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="font-medium text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-500">
                            <span className="font-mono">{s.slug}</span> • {s.type} • {s.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {newSiteOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                <Card className="w-full max-w-lg">
                  <CardHeader>
                    <CardTitle>Create a new site</CardTitle>
                    <CardDescription>Choose a name and a slug (used for your subdomain later).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Site name</Label>
                        <Input
                          value={newSiteName}
                          onChange={(e) => {
                            setNewSiteName(e.target.value);
                            if (!newSiteSlug) setNewSiteSlug(slugify(e.target.value));
                          }}
                          placeholder="Acme Car Wash"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Slug</Label>
                        <Input
                          value={newSiteSlug}
                          onChange={(e) => setNewSiteSlug(slugify(e.target.value))}
                          placeholder="acme-car-wash"
                        />
                        <div className="text-xs text-slate-500">Lowercase letters, numbers, hyphens only.</div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => setNewSiteOpen(false)} disabled={busy}>
                          Cancel
                        </Button>
                        <Button onClick={() => createSite()} disabled={busy || !newSiteName || !newSiteSlug}>
                          {busy ? 'Creating…' : 'Create site'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
