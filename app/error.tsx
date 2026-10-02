'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('NEXA UI error:', error);
  }, [error]);

  return (
    <main className="error-screen">
      <div className="error-card">
        <span className="hero-badge">NEXA · RECOVERY</span>
        <h1>Something went wrong.</h1>
        <p>NEXA hit an unexpected problem. Your saved workspace is still protected. Try the page again.</p>
        <button className="primary-btn" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
