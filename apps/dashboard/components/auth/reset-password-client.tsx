'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAppContext } from '../app-context';

export function ResetPasswordClient({ onBack }: { onBack: () => void }) {
  const { apiBase } = useAppContext();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function requestReset() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`${apiBase}/password-reset/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Reset request failed');

      // MVP: token is returned directly.
      if (json?.token) {
        setToken(json.token);
        setInfo(`Reset token generated (expires ${json.expires_at}). Paste it below to set a new password.`);
      } else {
        setInfo('If that email exists, a reset token was generated.');
      }
    } catch (e: any) {
      setError(e?.message || 'Reset request failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`${apiBase}/password-reset/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Reset failed');
      setInfo('Password updated. Go back and log in with your new password.');
    } catch (e: any) {
      setError(e?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>MVP mode: we generate a reset token and show it here (no email yet).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {error ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTitle>Couldn’t reset</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {info ? (
            <Alert>
              <AlertTitle>Info</AlertTitle>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <Button variant="outline" onClick={requestReset} disabled={busy || !email}>
            {busy ? 'Working…' : 'Request reset token'}
          </Button>

          <div className="h-px bg-slate-200" />

          <div className="grid gap-2">
            <Label>Reset token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="(token will appear here)" />
          </div>
          <div className="grid gap-2">
            <Label>New password</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" />
          </div>
          <Button onClick={confirmReset} disabled={busy || !token || newPassword.length < 8}>
            {busy ? 'Working…' : 'Set new password'}
          </Button>

          <Button variant="ghost" onClick={onBack}>
            Back to login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
