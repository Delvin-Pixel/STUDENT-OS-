'use client';

import { FormEvent, useState } from 'react';
import { NEXA_VERSION } from '@/lib/version';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Authentication failed.');
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-orb orb-one" />
      <div className="auth-orb orb-two" />
      <section className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark">N</div><div className="brand-copy"><b>NEXA</b><span>by CIPHER</span></div></div>
        <span className="hero-badge">NEXA {NEXA_VERSION} · PRIVATE ACCESS</span>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Start with NEXA.'}</h1>
        <p>{mode === 'login' ? 'Sign in to keep your conversations and projects synced.' : 'Create your NEXA account. Your conversations will live in your private workspace.'}</p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required /></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
          <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Working…' : mode === 'login' ? 'Enter NEXA' : 'Create account'}</button>
        </form>

        <button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
        <div className="auth-foot">CIPHER · General AI · Understand. Create. Accomplish.</div>
      </section>
    </main>
  );
}
