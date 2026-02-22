'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <main style={{ fontFamily: 'system-ui', padding: 24, lineHeight: 1.4 }}>
          <h1>Global error</h1>
          <p style={{ color: '#b00020' }}>{error?.message || 'Unknown error'}</p>
          {error?.digest ? (
            <p>
              Digest: <code>{error.digest}</code>
            </p>
          ) : null}
          <button onClick={() => reset()}>Retry</button>
        </main>
      </body>
    </html>
  );
}
