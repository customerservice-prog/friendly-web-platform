'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, lineHeight: 1.4 }}>
      <h1>Dashboard error</h1>
      <p style={{ color: '#b00020' }}>
        {error?.message || 'Unknown client error'}
      </p>
      {error?.digest ? (
        <p>
          Digest: <code>{error.digest}</code>
        </p>
      ) : null}
      <button onClick={() => reset()}>Retry</button>
      <p style={{ marginTop: 16 }}>
        If this persists, open your browser console and copy the first red error line.
      </p>
    </main>
  );
}
