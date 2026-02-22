'use client';

import { useEffect, useState } from 'react';

export function NotHydratedHint() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (hydrated) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      If clicking buttons does nothing, your browser may not be running the page JavaScript (hydration failed).
      Open DevTools → Console and copy the first red error. Also check the Network tab for requests to
      <span className="font-mono"> /_next/</span> returning 404/500.
    </div>
  );
}
