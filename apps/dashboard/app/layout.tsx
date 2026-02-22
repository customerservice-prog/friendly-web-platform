import './globals.css';

export const metadata = {
  title: 'Friendly Web Platform',
  description: 'Control plane dashboard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
