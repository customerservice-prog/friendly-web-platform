'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAppContext } from '../app-context';
import { ResetPasswordClient } from './reset-password-client';

export function AuthPageClient() {
  const { apiBase, setToken } = useAppContext();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);

  async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
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

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const body = mode === 'signup' ? { email, password, orgName } : { email, password };

      const data = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
      setToken(data.token);
      router.replace('/sites');
    } catch (e: any) {
      setError(e?.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto flex max-w-5xl justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {error ? (
            <div className="mb-6">
              <Alert className="border-red-200 bg-red-50">
                <AlertTitle>Action needed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {showReset ? (
            <ResetPasswordClient onBack={() => setShowReset(false)} />
          ) : (
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
                  <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
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
                    <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Friendly Rental" />
                  </div>
                ) : null}

                <Button onClick={submit} disabled={busy}>
                  {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
                </Button>

                {mode === 'login' ? (
                  <button
                    type="button"
                    className="text-left text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => setShowReset(true)}
                  >
                    Forgot your password?
                  </button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </main>
    </div>
  );
}
