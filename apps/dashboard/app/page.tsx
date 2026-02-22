export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, lineHeight: 1.4 }}>
      <h1>Friendly Web Platform</h1>
      <p>Dashboard is deployed. Next step: auth + orgs + sites.</p>
      <p>
        API base URL: <code>{api}</code>
      </p>
      <p>
        Health check: <a href={`${api}/health`}>{api}/health</a>
      </p>
    </main>
  );
}
