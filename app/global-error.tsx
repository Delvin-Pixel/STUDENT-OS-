'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="error-screen">
          <div className="error-card">
            <span className="hero-badge">NEXA · RECOVERY</span>
            <h1>NEXA needs a refresh.</h1>
            <p>The application shell could not be loaded. Your saved data is stored separately from this page.</p>
            <button className="primary-btn" onClick={() => reset()}>Reload NEXA</button>
          </div>
        </main>
      </body>
    </html>
  );
}
