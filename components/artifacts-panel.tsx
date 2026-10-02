'use client';

import { useEffect, useMemo, useState } from 'react';

type Artifact = {
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  title: string;
  filename: string;
  artifact_type: 'document' | 'report' | 'code' | 'data' | 'note';
  mime_type: string;
  language: string | null;
  content: string;
  version: number;
  updated_at: string;
};

const labels: Record<Artifact['artifact_type'], string> = {
  document: 'Document',
  report: 'Report',
  code: 'Code',
  data: 'Data',
  note: 'Note',
};

export function ArtifactsPanel({ projectId, conversationId }: { projectId?: string | null; conversationId?: string | null }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function loadArtifacts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (conversationId) params.set('conversationId', conversationId);
    const response = await fetch(`/api/artifacts?${params.toString()}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      setArtifacts(data.artifacts ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void loadArtifacts(); }, [projectId, conversationId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? artifacts.filter((artifact) => `${artifact.title} ${artifact.filename}`.toLowerCase().includes(needle)) : artifacts;
  }, [artifacts, search]);

  const selected = artifacts.find((artifact) => artifact.id === selectedId) ?? filtered[0] ?? null;

  async function removeArtifact(id: string) {
    const artifact = artifacts.find((item) => item.id === id);
    if (!artifact || !window.confirm(`Delete "${artifact.title}"?`)) return;
    const response = await fetch(`/api/artifacts/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setArtifacts((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function download(id: string) {
    window.location.href = `/api/artifacts/${id}/download`;
  }

  async function copyContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setNotice('Copied to clipboard.');
      window.setTimeout(() => setNotice(null), 1800);
    } catch {
      setNotice('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <div className="artifact-view">
      <div className="artifact-header">
        <div>
          <span className="hero-badge">NEXA · ARTIFACTS</span>
          <h2>Your work, made durable.</h2>
          <p>NEXA can turn conversations into reusable documents, reports, code, notes, JSON, and CSV files. Update them later without losing the original workspace.</p>
        </div>
        <div className="artifact-stat"><b>{artifacts.length}</b><span>saved artifacts</span></div>
      </div>
      <div className="artifact-layout">
        <aside className="artifact-list-card">
          <div className="artifact-list-top"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artifacts…" /><button onClick={() => void loadArtifacts()} aria-label="Refresh artifacts">↻</button></div>
          {loading ? <div className="artifact-empty">Loading artifacts…</div> : filtered.length === 0 ? <div className="artifact-empty"><b>No artifacts here yet.</b><span>Ask NEXA to create a reusable file from your work.</span></div> : (
            <div className="artifact-list">
              {filtered.map((artifact) => (
                <button key={artifact.id} className={`artifact-row ${selected?.id === artifact.id ? 'selected' : ''}`} onClick={() => setSelectedId(artifact.id)}>
                  <span className="artifact-icon">{artifact.artifact_type === 'code' ? '</>' : artifact.artifact_type === 'data' ? '{}' : '▱'}</span>
                  <span className="artifact-row-copy"><b>{artifact.title}</b><small>{artifact.filename} · v{artifact.version}</small></span>
                </button>
              ))}
            </div>
          )}
        </aside>
        <section className="artifact-editor">
          {selected ? (
            <>
              <div className="artifact-editor-head">
                <div><span className="artifact-kind">{labels[selected.artifact_type as Artifact['artifact_type']]}</span><h3>{selected.title}</h3><p>{selected.filename} · version {selected.version}</p></div>
                <div className="artifact-actions"><button className="secondary-btn" onClick={() => void copyContent(selected.content)}>Copy</button><button className="primary-btn compact" onClick={() => download(selected.id)}>Download</button><button className="danger-icon" onClick={() => void removeArtifact(selected.id)} aria-label="Delete artifact">×</button></div>
              </div>
              <textarea className="artifact-content" value={selected.content} readOnly spellCheck={false} />
              {notice && <div className="notice">{notice}</div>}
            </>
          ) : <div className="artifact-empty large"><b>Select an artifact</b><span>Your generated work will appear here with preview, copy, and download controls.</span></div>}
        </section>
      </div>
    </div>
  );
}
