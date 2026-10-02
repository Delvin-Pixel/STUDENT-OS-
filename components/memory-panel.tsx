'use client';

import { useEffect, useState } from 'react';

type Memory = {
  id: string;
  project_id: string | null;
  scope: 'saved' | 'project';
  kind: 'fact' | 'preference' | 'instruction' | 'knowledge';
  label: string;
  content: string;
  importance: number;
};

const KINDS = ['fact', 'preference', 'instruction', 'knowledge'] as const;

export function MemoryPanel({ projectId, projectName }: { projectId: string | null; projectName?: string | null }) {
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState<Memory[]>([]);
  const [project, setProject] = useState<Memory[]>([]);
  const [content, setContent] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<Memory['kind']>('fact');
  const [scope, setScope] = useState<'saved' | 'project'>('saved');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const [settingResponse, savedResponse] = await Promise.all([
      fetch('/api/settings/memory', { cache: 'no-store' }),
      fetch('/api/memories?scope=saved', { cache: 'no-store' }),
    ]);
    if (settingResponse.ok) {
      const setting = await settingResponse.json();
      setEnabled(Boolean(setting.enabled));
    }
    if (savedResponse.ok) {
      const data = await savedResponse.json();
      setSaved(data.memories ?? []);
    }
    if (projectId) {
      const response = await fetch(`/api/memories?scope=project&projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      if (response.ok) setProject((await response.json()).memories ?? []);
    } else {
      setProject([]);
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function toggle(next: boolean) {
    setBusy(true);
    const response = await fetch('/api/settings/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    });
    if (response.ok) {
      setEnabled(next);
      setNotice(next ? 'Memory is on. NEXA will use saved and project context.' : 'Memory is off. NEXA will stop using and saving persistent memory.');
    }
    setBusy(false);
  }

  async function addMemory() {
    if (!content.trim()) return;
    if (scope === 'project' && !projectId) {
      setNotice('Open a project before adding project memory.');
      return;
    }
    setBusy(true);
    const response = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, projectId: scope === 'project' ? projectId : null, kind, label, content, importance: 3 }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data?.error ?? 'Could not save memory.');
      setBusy(false);
      return;
    }
    setContent('');
    setLabel('');
    setNotice('Memory saved.');
    await load();
    setBusy(false);
  }

  async function deleteOne(id: string) {
    const response = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    await load();
    setNotice('Memory removed.');
  }

  async function editOne(memory: Memory) {
    const next = window.prompt('Update this memory', memory.content);
    if (!next?.trim() || next.trim() === memory.content) return;
    const response = await fetch(`/api/memories/${memory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next.trim() }),
    });
    if (response.ok) {
      await load();
      setNotice('Memory updated.');
    }
  }

  const current = scope === 'project' ? project : saved;

  return (
    <div className="memory-view">
      <div className="memory-header">
        <div>
          <span className="hero-badge">NEXA · MEMORY</span>
          <h2>Memory you control.</h2>
          <p>NEXA only keeps durable context when memory is enabled. You can inspect, edit, remove, or disable it at any time.</p>
        </div>
        <button className={`memory-toggle ${enabled ? 'on' : ''}`} onClick={() => void toggle(!enabled)} disabled={busy}>
          <span className="toggle-dot" /> {enabled ? 'Memory on' : 'Memory off'}
        </button>
      </div>

      <div className="memory-grid">
        <section className="memory-card memory-form-card">
          <div className="section-kicker">Add memory</div>
          <h3>{scope === 'project' && projectName ? `For ${projectName}` : 'Saved across NEXA'}</h3>
          <div className="memory-segment">
            <button className={scope === 'saved' ? 'active' : ''} onClick={() => setScope('saved')}>Saved</button>
            <button className={scope === 'project' ? 'active' : ''} onClick={() => setScope('project')} disabled={!projectId}>Project</button>
          </div>
          <select value={kind} onChange={(event) => setKind(event.target.value as Memory['kind'])}>
            {KINDS.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label (optional)" maxLength={120} />
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Example: I prefer practical, step-by-step explanations." maxLength={1200} />
          <button className="primary-btn" disabled={!enabled || !content.trim() || busy} onClick={() => void addMemory()}>Save memory</button>
          {notice && <div className="notice">{notice}</div>}
        </section>

        <section className="memory-card">
          <div className="memory-list-head"><div><span className="section-kicker">{scope === 'project' ? 'Project memory' : 'Saved memory'}</span><h3>{scope === 'project' ? (projectName || 'Current project') : 'Your durable context'}</h3></div><span className="memory-count">{current.length}</span></div>
          {current.length === 0 ? <div className="memory-empty"><b>No memory here yet.</b><span>Tell NEXA to remember something, or add one manually.</span></div> : (
            <div className="memory-list">
              {current.map((memory) => (
                <article className="memory-item" key={memory.id}>
                  <div className="memory-item-top"><span className="memory-kind">{memory.kind}</span><span className="memory-actions"><button onClick={() => void editOne(memory)}>Edit</button><button onClick={() => void deleteOne(memory.id)}>Remove</button></span></div>
                  {memory.label && <b>{memory.label}</b>}
                  <p>{memory.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
