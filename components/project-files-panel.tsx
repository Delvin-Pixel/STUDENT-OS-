'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ProjectFile = {
  id: string;
  project_id: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  version: number;
  updated_at: string;
  content?: string;
  source_kind?: 'text' | 'rich';
  source_media_type?: string;
  source_size_bytes?: number;
  source_sha256?: string;
  extraction_status?: 'not_required' | 'pending' | 'ready' | 'failed';
  extraction_model?: string | null;
  extraction_failure_code?: string | null;
  semantic_status?: 'pending' | 'ready' | 'failed' | null;
  semantic_model?: string | null;
  semantic_chunk_count?: number | null;
  semantic_failure_code?: string | null;
};

const RICH_MEDIA_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function ProjectFilesPanel({ projectId, projectName }: { projectId: string | null; projectName?: string | null }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    if (!projectId) {
      setFiles([]);
      setSelectedFile(null);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      setFiles(data.files ?? []);
    } else {
      setFiles([]);
    }
    setLoading(false);
  }

  useEffect(() => { void loadFiles(); }, [projectId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? files.filter((file) => file.filename.toLowerCase().includes(needle)) : files;
  }, [files, search]);

  async function openFile(file: ProjectFile) {
    if (!projectId) return;
    setSelectedId(file.id);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data?.error ?? 'Could not open project file.');
      return;
    }
    setSelectedFile(data.file ?? null);
  }

  async function upload(file: File) {
    if (!projectId) {
      setNotice('Open a project before adding persistent files.');
      return;
    }
    const mediaType = file.type || '';
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const rich = RICH_MEDIA_TYPES.has(mediaType) || ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
    if (!rich && file.size > 500_000) {
      setNotice('Text project knowledge files must be 500 KB or smaller.');
      return;
    }
    if (rich && file.size > 3 * 1024 * 1024) {
      setNotice('Rich project files must be 3 MB or smaller. Your plan may have a lower server-side limit.');
      return;
    }
    setBusy(true);
    try {
      let response: Response;
      if (rich) {
        const data = await fileAsDataUrl(file);
        response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/rich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ filename: file.name, mediaType: file.type || null, size: file.size, data }),
        });
      } else {
        const content = await file.text();
        response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ filename: file.name, mediaType: file.type || null, content }),
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data?.error ?? 'Could not save project file.');
        return;
      }
      const saved = data.file as ProjectFile | undefined;
      const richNotice = saved?.source_kind === 'rich'
        ? saved.extraction_status === 'ready'
          ? `${file.name} added and searchable extraction is ready.`
          : saved.extraction_status === 'failed'
            ? `${file.name} added. Extraction can be retried from the file panel.`
            : `${file.name} added. Searchable extraction is pending.`
        : `${file.name} added to ${projectName ?? 'the project'}.`;
      setNotice(richNotice);
      await loadFiles();
      if (saved?.id) await openFile(saved);
    } catch {
      setNotice('Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function renameFile(file: ProjectFile) {
    if (!projectId) return;
    const filename = window.prompt('Rename project file', file.filename)?.trim();
    if (!filename || filename === file.filename) return;
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, expectedVersion: file.version }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data?.error ?? 'Could not rename project file.');
      return;
    }
    setNotice('Project file renamed.');
    await loadFiles();
    setSelectedFile(data.file ?? null);
  }

  async function removeFile(file: ProjectFile) {
    if (!projectId || !window.confirm(`Remove "${file.filename}" from this project?`)) return;
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
    if (!response.ok) return;
    if (selectedId === file.id) {
      setSelectedId(null);
      setSelectedFile(null);
    }
    setNotice('Project file removed.');
    await loadFiles();
  }

  async function rebuildExtraction(file: ProjectFile) {
    if (!projectId || file.source_kind !== 'rich') return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}/extract`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data?.error ?? 'Could not extract searchable project knowledge.');
        await loadFiles();
        await openFile(file);
        return;
      }
      setNotice('Rich-file extraction is ready and semantic indexing was refreshed.');
      await loadFiles();
      await openFile(file);
    } finally {
      setBusy(false);
    }
  }

  function openOriginalSource(file: ProjectFile) {
    if (!projectId || file.source_kind !== 'rich') return;
    window.open(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}/source`, '_blank', 'noopener,noreferrer');
  }

  async function rebuildSemanticIndex(file: ProjectFile) {
    if (!projectId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}/semantic-index`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data?.error ?? 'Could not rebuild semantic index.');
        return;
      }
      const status = data?.semanticIndex?.status;
      setNotice(status === 'ready' ? 'Semantic index is ready.' : status === 'failed' ? 'Semantic indexing is unavailable; lexical search still works.' : 'Semantic index refresh completed.');
      await loadFiles();
      await openFile(file);
    } finally {
      setBusy(false);
    }
  }

  async function copyContent() {
    if (!selectedFile?.content) return;
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <div className="artifact-view">
      <div className="artifact-header">
        <div>
          <span className="hero-badge">NEXA · PROJECT FILES</span>
          <h2>Knowledge that stays with the project.</h2>
          <p>Upload bounded text knowledge plus PDFs and images. NEXA stores rich originals privately, derives searchable text, and retrieves relevant content across conversations without mixing projects.</p>
        </div>
        <div className="artifact-stat"><b>{files.length}</b><span>project files</span></div>
      </div>

      {!projectId ? (
        <div className="artifact-empty large"><b>Open a project first.</b><span>Persistent files belong to one project so NEXA can keep context isolated.</span></div>
      ) : (
        <div className="artifact-layout">
          <aside className="artifact-list-card">
            <div className="artifact-list-top">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project files…" />
              <button onClick={() => void loadFiles()} aria-label="Refresh project files">↻</button>
            </div>
            <div className="project-file-upload">
              <button className="primary-btn compact" disabled={busy} onClick={() => inputRef.current?.click()}>＋ Add file</button>
              <input ref={inputRef} hidden type="file" accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.css,.js,.jsx,.ts,.tsx,.py,.sql,.xml,.pdf,.jpg,.jpeg,.png,.webp,.gif,text/plain,text/markdown,text/csv,application/json,text/html,text/css,text/javascript,text/typescript,text/x-python,application/sql,application/xml,application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) void upload(file);
              }} />
            </div>
            {loading ? <div className="artifact-empty">Loading project files…</div> : filtered.length === 0 ? <div className="artifact-empty"><b>No persistent files yet.</b><span>Add a project knowledge file to make it available across conversations.</span></div> : (
              <div className="artifact-list">
                {filtered.map((file) => (
                  <button key={file.id} className={`artifact-row ${selectedId === file.id ? 'selected' : ''}`} onClick={() => void openFile(file)}>
                    <span className="artifact-icon">⌑</span>
                    <span className="artifact-row-copy"><b>{file.filename}</b><small>{Math.max(1, Math.round((file.source_size_bytes ?? file.size_bytes) / 1024))} KB · v{file.version}{file.source_kind === 'rich' ? ` · extraction ${file.extraction_status ?? 'pending'}` : ''} · semantic {file.semantic_status ?? 'pending'}</small></span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="artifact-editor">
            {selectedFile ? (
              <>
                <div className="artifact-editor-head">
                  <div><span className="artifact-kind">{selectedFile.source_kind === 'rich' ? 'Rich project knowledge' : 'Project knowledge'}</span><h3>{selectedFile.filename}</h3><p>{selectedFile.source_media_type ?? selectedFile.media_type} · version {selectedFile.version} · source SHA-256 {(selectedFile.source_sha256 ?? selectedFile.sha256).slice(0, 12)}…{selectedFile.source_kind === 'rich' ? ` · extraction ${selectedFile.extraction_status ?? 'pending'}` : ''} · semantic {selectedFile.semantic_status ?? 'pending'}{selectedFile.semantic_chunk_count ? ` · ${selectedFile.semantic_chunk_count} chunks` : ''}</p></div>
                  <div className="artifact-actions">{selectedFile.source_kind === 'rich' && <button className="secondary-btn" disabled={busy} onClick={() => void rebuildExtraction(selectedFile)}>Extract</button>}{selectedFile.source_kind === 'rich' && <button className="secondary-btn" onClick={() => openOriginalSource(selectedFile)}>Original</button>}<button className="secondary-btn" disabled={busy || selectedFile.extraction_status === 'pending'} onClick={() => void rebuildSemanticIndex(selectedFile)}>Reindex</button><button className="secondary-btn" onClick={() => void copyContent()}>Copy</button><button className="secondary-btn" onClick={() => void renameFile(selectedFile)}>Rename</button><button className="danger-icon" onClick={() => void removeFile(selectedFile)} aria-label="Delete project file">×</button></div>
                </div>
                <textarea className="artifact-content" value={selectedFile.content ?? ''} readOnly spellCheck={false} />
                {notice && <div className="notice">{notice}</div>}
              </>
            ) : <div className="artifact-empty large"><b>Select a project file</b><span>Text files keep exact content and integrity hashes. PDFs/images keep a fenced original source plus derived searchable text; semantic indexing never replaces lexical search.</span>{notice && <div className="notice">{notice}</div>}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
