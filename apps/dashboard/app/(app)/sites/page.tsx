'use client';

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useAppContext } from '../../../components/app-context';
import { useRouter } from 'next/navigation';

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

export default function SitesPage() {
  const { apiBase, token, selectedOrgId } = useAppContext();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [newSiteOpen, setNewSiteOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteSlug, setNewSiteSlug] = useState('');

  async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {})
      }
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text };
    }
    if (!res.ok) throw new Error(json?.message || json?.error || `Request failed (${res.status})`);
    return json;
  }

  async function loadSites() {
    if (!selectedOrgId) return;
    const data = await apiFetch(`/orgs/${selectedOrgId}/sites`);
    setSites(data.sites || []);
  }

  useEffect(() => {
    // Avoid redirect flicker: AppProvider loads token from localStorage.
    if (!token) {
      router.replace('/');
      return;
    }
    loadSites().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedOrgId]);

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
      await loadSites();
    } catch (e: any) {
      setError(e?.message || 'Failed to create site');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xl font-semibold tracking-tight">Sites</div>
        <div className="text-xs text-slate-500">Manage sites for the selected organization.</div>
      </div>

      {error ? (
        <Alert className="border-red-200 bg-red-50">
          <AlertTitle>Action needed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => setNewSiteOpen(true)} disabled={!selectedOrgId}>
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
                  <Input value={newSiteSlug} onChange={(e) => setNewSiteSlug(slugify(e.target.value))} placeholder="acme-car-wash" />
                  <div className="text-xs text-slate-500">Lowercase letters, numbers, hyphens only.</div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewSiteOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={createSite} disabled={busy || !newSiteName || !newSiteSlug}>
                    {busy ? 'Creating…' : 'Create site'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
