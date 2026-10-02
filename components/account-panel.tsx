'use client';

import { useState } from 'react';

export function AccountPanel({ user }: { user: { name: string; email: string; plan: 'free' | 'premium' } }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');

  async function exportData() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/account/export', { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Could not export your data.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nexa-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('Your NEXA data export is ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not export your data.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (confirmation !== 'DELETE MY ACCOUNT') {
      setNotice('Type DELETE MY ACCOUNT exactly before continuing.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteEmail, password, confirmation }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not delete the account.');
      window.location.href = '/';
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the account.');
      setBusy(false);
    }
  }

  return (
    <div className="account-view">
      <div className="account-header">
        <div><span className="hero-badge">NEXA · ACCOUNT</span><h2>Your account</h2><p>Manage your identity, portability, and the controls that keep your NEXA workspace yours.</p></div>
      </div>
      {notice && <div className="notice">{notice}</div>}
      <div className="account-grid">
        <section className="account-card">
          <span className="section-kicker">Profile</span>
          <div className="account-profile"><div className="account-big-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><h3>{user.name}</h3><p>{user.email}</p><span className="account-plan">{user.plan === 'premium' ? 'NEXA Premium' : 'NEXA Free'}</span></div></div>
        </section>
        <section className="account-card">
          <span className="section-kicker">Your data</span>
          <h3>Take it with you</h3>
          <p>Download a JSON export containing your profile and user-created NEXA data. Authentication secrets and temporary operational data are excluded.</p>
          <button className="primary-btn compact" onClick={() => void exportData()} disabled={busy}>↓ &nbsp; {busy ? 'Preparing…' : 'Export my data'}</button>
        </section>
        <section className="account-card account-danger-card">
          <span className="section-kicker">Danger zone</span>
          <h3>Delete account</h3>
          <p>This permanently removes your NEXA account and the workspace data connected to it. This cannot be undone.</p>
          {!deleteMode ? (
            <button className="ghost-btn danger" onClick={() => { setDeleteMode(true); setNotice(null); }}>Delete my account</button>
          ) : (
            <div className="delete-account-form">
              <label>Account email<input type="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} autoComplete="email" /></label><label>Current password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
              <label>Type DELETE MY ACCOUNT<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} spellCheck={false} /></label>
              <div className="form-actions"><button className="ghost-btn" onClick={() => setDeleteMode(false)} disabled={busy}>Cancel</button><button className="danger-btn" onClick={() => void deleteAccount()} disabled={busy}>Permanently delete</button></div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
