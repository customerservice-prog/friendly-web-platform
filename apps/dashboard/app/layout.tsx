export const metadata = {
  title: 'Friendly Web Platform',
  description: 'Control plane dashboard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
