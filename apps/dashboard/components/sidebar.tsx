'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, CreditCard, Globe, LayoutDashboard, LogOut, PanelsTopLeft } from 'lucide-react';
import { useAppContext } from './app-context';
import { Button } from '../components/ui/button';

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={
        'flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors ' +
        (active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100')
      }
    >
      <Icon size={16} />
      <span>{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const { apiBase, mounted, token, logout, orgs, selectedOrgId, setSelectedOrgId } = useAppContext();
  const router = useRouter();

  return (
    <aside className="sticky top-0 h-screen w-[280px] border-r border-border bg-white">
      <div className="flex h-full flex-col p-4">
        <div className="mb-6">
          <div className="text-sm font-semibold text-slate-900">Friendly Web Platform</div>
          <div className="mt-1 text-xs text-slate-500">
            API: <span className="font-mono">{apiBase}</span>
          </div>
          <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
            {mounted ? 'Live' : 'Loading'}
          </div>
        </div>

        <nav className="grid gap-1">
          <NavItem href="/sites" icon={PanelsTopLeft} label="Sites" />
          <NavItem href="/" icon={LayoutDashboard} label="Auth" />
          <div className="mt-2" />
          <div className="pointer-events-none opacity-50">
            <NavItem href="/domains" icon={Globe} label="Domains" />
            <NavItem href="/billing" icon={CreditCard} label="Billing" />
          </div>
        </nav>

        <div className="mt-6">
          <div className="mb-2 text-xs font-medium text-slate-600">Organization</div>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-2">
            <Building2 size={16} className="text-slate-500" />
            <select
              className="h-full w-full bg-transparent text-sm outline-none"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              disabled={!token || orgs.length === 0}
            >
              {orgs.length === 0 ? <option value="">No orgs</option> : null}
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              logout();
              router.replace('/');
            }}
            disabled={!token}
          >
            <LogOut size={16} className="mr-2" /> Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
