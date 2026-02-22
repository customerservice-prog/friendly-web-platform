import { AppProvider } from '../../components/app-context';
import { Sidebar } from '../../components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-50">
        <div className="flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
          </div>
        </div>
      </div>
    </AppProvider>
  );
}
