import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="error-screen">
      <div className="error-card">
        <span className="hero-badge">NEXA · 404</span>
        <h1>That workspace does not exist.</h1>
        <p>The page may have moved, or the resource may belong to another account.</p>
        <Link className="primary-btn" href="/">Return to NEXA</Link>
      </div>
    </main>
  );
}
