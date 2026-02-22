'use client';

import { useEffect, useMemo, useState } from 'react';

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

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('signup');

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
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
    const name = prompt('Site name?');
    if (!name) return;
    const slug = prompt('Slug (lowercase, hyphenated)?', name.toLowerCase().replace(/\s+/g, '-'));
    if (!slug) return;

    await apiFetch(`/orgs/${selectedOrgId}/sites`, {
      method: 'POST',
      body: JSON.stringify({ name, slug, type: 'standard_site' })
    });
    await loadSites(selectedOrgId);
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setToken('');
    setOrgs([]);
    setSites([]);
    setSelectedOrgId('');
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, lineHeight: 1.4, maxWidth: 900 }}>
      <h1>Friendly Web Platform</h1>

      <p>
        API: <code>{api}</code> — <a href={`${api}/health`}>health</a>
      </p>

      {!token ? (
        <section style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setMode('signup')} disabled={mode === 'signup'}>
              Sign up
            </button>
            <button onClick={() => setMode('login')} disabled={mode === 'login'}>
              Log in
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              placeholder="Password (min 8 chars)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' ? (
              <input
                placeholder="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            ) : null}
            {error ? (
              <div style={{ color: '#b00020', fontSize: 14, paddingTop: 4 }}>
                {error}
                {error.includes('JWT_SECRET') ? (
                  <div style={{ marginTop: 6, color: '#555' }}>
                    Fix: in Render set <code>JWT_SECRET</code> on <strong>friendly-api</strong> and{' '}
                    <strong>friendly-worker</strong>, then redeploy.
                  </div>
                ) : null}
              </div>
            ) : null}
            <button onClick={handleAuth} disabled={busy}>
              {busy ? 'Working…' : 'Continue'}
            </button>
          </div>
        </section>
      ) : (
        <section style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Authenticated</strong>
            <button onClick={logout}>Logout</button>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label>
              Org:{' '}
              <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.role})
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => createSite().catch((e) => alert(e.message))} disabled={!selectedOrgId}>
              + New Site
            </button>
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: 8 }}>
            <div style={{ padding: 12, borderBottom: '1px solid #eee' }}>
              <strong>Sites</strong>
            </div>
            <div style={{ padding: 12 }}>
              {sites.length === 0 ? (
                <p>No sites yet.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {sites.map((s) => (
                    <li key={s.id}>
                      <strong>{s.name}</strong> — <code>{s.slug}</code> — {s.type} — {s.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
