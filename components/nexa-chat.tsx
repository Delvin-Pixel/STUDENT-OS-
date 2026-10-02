'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MemoryPanel } from '@/components/memory-panel';
import { ArtifactsPanel } from '@/components/artifacts-panel';
import { WorkflowPanel } from '@/components/workflow-panel';
import { AccountPanel } from '@/components/account-panel';
import { ActivityPanel } from '@/components/activity-panel';
import { ProjectFilesPanel } from '@/components/project-files-panel';
import { NEXA_VERSION } from '@/lib/version';

type Role = 'user' | 'assistant' | 'system';
type MessageSource = { order: number; label: string; sourceType: string; sourceId?: string | null; title: string; excerpt: string; retrieval?: string | null; relevance?: number | null; sourceUpdatedAt?: string | null; sourceUrl?: string | null; provider?: string | null };
type Message = { id?: string; role: Role; content: string; sources?: MessageSource[] };
type Conversation = { id: string; project_id?: string | null; title: string; updated_at: string };
type Project = { id: string; name: string; description: string; conversation_count?: number; file_count?: number; updated_at: string };
type Usage = { plan: 'free' | 'premium'; used: number; limit: number; remaining: number };
type VoiceDraft = { transcript: string; durationMs: number | null; language?: string | null; source: 'microphone' | 'imported' | 'unknown' };

type View = 'chat' | 'projects' | 'files' | 'memory' | 'artifacts' | 'workflows' | 'activity' | 'account';

const SUGGESTIONS = [
  ['Research', 'Explain the most important ideas in a topic I am learning.'],
  ['Create', 'Turn my rough idea into something polished and usable.'],
  ['Build', 'Help me design and code a real product from scratch.'],
];

export function NexaChat({ user }: { user: { name: string; email: string; plan: 'free' | 'premium'; memory_enabled: boolean } }) {
  const [view, setView] = useState<View>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [resumeWorkflowId, setResumeWorkflowId] = useState<string | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStartedAtRef = useRef<number | null>(null);
  const voiceStopTimerRef = useRef<number | null>(null);

  async function loadProjects() {
    const response = await fetch('/api/projects', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setProjects(data.projects ?? []);
  }

  async function loadConversations(projectId?: string | null) {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const response = await fetch(`/api/conversations${query}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations ?? []);
  }

  async function loadUsage() {
    const response = await fetch('/api/usage', { cache: 'no-store' });
    if (!response.ok) return;
    setUsage(await response.json());
  }

  useEffect(() => {
    void Promise.all([loadProjects(), loadConversations(null), loadUsage()]);
  }, []);

  useEffect(() => () => {
    if (voiceStopTimerRef.current !== null) window.clearTimeout(voiceStopTimerRef.current);
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      recorder.stop();
    }
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const canSend = useMemo(() => (input.trim().length > 0 || selectedFiles.length > 0 || Boolean(voiceDraft?.transcript)) && !loading && !recordingVoice && !transcribingVoice, [input, loading, recordingVoice, selectedFiles.length, transcribingVoice, voiceDraft?.transcript]);

  async function openConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setConversationId(id);
    setSelectedProjectId(data.conversation?.project_id ?? null);
    setView('chat');
    setConversationMenuId(null);
    setMessages(
      (data.messages ?? [])
        .map((message: { role: Role; content: string; id: string; sources?: MessageSource[] }) => ({
          role: message.role,
          content: message.content,
          id: message.id,
          sources: Array.isArray(message.sources) ? message.sources : [],
        }))
        .filter((message: Message) => message.role !== 'system'),
    );
    await loadConversations(data.conversation?.project_id ?? null);
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setVoiceDraft(null);
    setView('chat');
    setConversationMenuId(null);
    setNotice(null);
  }

  async function selectProject(id: string | null) {
    setSelectedProjectId(id);
    setConversationId(null);
    setMessages([]);
    setInput('');
    setVoiceDraft(null);
    setView('chat');
    setNotice(null);
    await loadConversations(id);
  }

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the voice recording.'));
      reader.readAsDataURL(blob);
    });
  }

  function clearVoiceRecorder() {
    if (voiceStopTimerRef.current !== null) {
      window.clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    voiceRecorderRef.current = null;
    voiceChunksRef.current = [];
    voiceStartedAtRef.current = null;
    setRecordingVoice(false);
  }

  async function transcribeVoiceBlob(blob: Blob, durationMs: number) {
    const maxBytes = user.plan === 'premium' ? 3 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!blob.size || blob.size > maxBytes) {
      setNotice(`Voice recordings are limited to ${user.plan === 'premium' ? '3' : '2'} MB on your plan.`);
      return;
    }
    const mediaType = (blob.type.split(';', 1)[0] || 'audio/webm').toLowerCase();
    const normalizedBlob = blob.type === mediaType ? blob : new Blob([blob], { type: mediaType });
    setTranscribingVoice(true);
    setNotice('Transcribing your voice…');
    try {
      const data = await blobToDataUrl(normalizedBlob);
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, mediaType, durationMs, source: 'microphone' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error ?? 'Could not transcribe that recording.');
      const voice = result.voice as VoiceDraft | undefined;
      if (!voice?.transcript?.trim()) throw new Error('No speech was detected in that recording.');
      setVoiceDraft({ ...voice, transcript: voice.transcript.trim(), source: 'microphone' });
      setNotice(voice.language ? `Voice transcript ready · ${voice.language.toUpperCase()}` : 'Voice transcript ready.');
    } catch (error) {
      setVoiceDraft(null);
      setNotice(error instanceof Error ? error.message : 'Could not transcribe that recording.');
    } finally {
      setTranscribingVoice(false);
    }
  }

  async function startVoiceRecording() {
    if (loading || recordingVoice || transcribingVoice) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('Voice recording is not supported in this browser yet.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = candidates.find((value) => MediaRecorder.isTypeSupported(value));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      voiceStartedAtRef.current = Date.now();
      setVoiceDraft(null);
      setNotice('Recording voice… tap Stop when you are done.');
      setRecordingVoice(true);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearVoiceRecorder();
        setNotice('Voice recording failed. Please try again.');
      };
      recorder.onstop = () => {
        const startedAt = voiceStartedAtRef.current ?? Date.now();
        const durationMs = Math.max(0, Date.now() - startedAt);
        const chunks = [...voiceChunksRef.current];
        const recordedType = (recorder.mimeType || mimeType || 'audio/webm').split(';', 1)[0];
        clearVoiceRecorder();
        if (durationMs < 300 || chunks.length === 0) {
          setNotice('That recording was too short to transcribe.');
          return;
        }
        void transcribeVoiceBlob(new Blob(chunks, { type: recordedType }), durationMs);
      };
      recorder.start(250);
      const maxDurationMs = user.plan === 'premium' ? 5 * 60 * 1000 : 2 * 60 * 1000;
      voiceStopTimerRef.current = window.setTimeout(() => {
        const active = voiceRecorderRef.current;
        if (active && active.state !== 'inactive') active.stop();
      }, maxDurationMs);
    } catch {
      clearVoiceRecorder();
      setNotice('Microphone access was not available. Check browser permission and try again.');
    }
  }

  function stopVoiceRecording() {
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if ((!content && selectedFiles.length === 0 && !voiceDraft?.transcript) || loading || recordingVoice || transcribingVoice) return;
    if (selectedFiles.some((file) => file.size > 3 * 1024 * 1024)) {
      setNotice('Each attachment must be 3 MB or smaller.');
      return;
    }

    const attachmentLabels = selectedFiles.map((file) => `📎 ${file.name}`).join('\n');
    const voiceLabel = voiceDraft?.transcript ? `🎙 ${voiceDraft.transcript}` : '';
    const visibleContent = [content, voiceLabel, attachmentLabels].filter(Boolean).join('\n\n');
    const nextMessages = [...messages, { role: 'user' as const, content: visibleContent }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setNotice(null);
    setLoading(true);
    const outgoingVoice = voiceDraft;

    try {
      const attachments = await Promise.all(selectedFiles.map(async (file) => ({
        filename: file.name,
        mediaType: file.type || 'application/octet-stream',
        size: file.size,
        data: await fileToDataUrl(file),
      })));
      setSelectedFiles([]);
      setVoiceDraft(null);
      setResumeWorkflowId(null);

      const idempotencyKey = crypto.randomUUID();
      const requestBody = JSON.stringify({ conversationId, projectId: selectedProjectId, workflowId: resumeWorkflowId, messages: nextMessages, attachments, voice: outgoingVoice });
      let response: Response | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        let transportFailed = false;
        try {
          const attemptResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
            body: requestBody,
          });
          if (attemptResponse.ok && attemptResponse.body) {
            response = attemptResponse;
            break;
          }
          const replayStatus = attemptResponse.headers.get('X-NEXA-Idempotency-Status');
          if (attemptResponse.status === 409 && replayStatus === 'in-progress' && attempt < 9) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 3000)));
            continue;
          }
          const data = await attemptResponse.json().catch(() => ({}));
          throw Object.assign(new Error(data?.error ?? 'Request failed.'), { nonRetryableHttp: true });
        } catch (error) {
          lastError = error;
          transportFailed = !(error instanceof Error && 'nonRetryableHttp' in error);
          if (!transportFailed || attempt >= 9) throw error;
          await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 3000)));
        }
      }
      if (!response || !response.ok || !response.body) {
        throw lastError instanceof Error ? lastError : new Error('Request failed.');
      }

      const returnedId = response.headers.get('X-NEXA-Conversation-Id');
      if (returnedId) setConversationId(returnedId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: 'assistant', content: assistantText }]);
      }
      const persistedConversationId = returnedId ?? conversationId;
      if (persistedConversationId) {
        await Promise.all([openConversation(persistedConversationId), loadProjects(), loadUsage()]);
      } else {
        await Promise.all([loadConversations(selectedProjectId), loadProjects(), loadUsage()]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      setMessages([...nextMessages, { role: 'assistant', content: `I couldn't complete that request yet.\n\n${message}` }]);
      await loadUsage();
    } finally {
      setLoading(false);
    }
  }

  function resumeWorkflow(id: string) {
    setResumeWorkflowId(id);
    setView('chat');
    setInput('Resume the saved workflow from its latest checkpoint.');
    setNotice('Ready to resume the workflow from its latest checkpoint.');
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: projectDescription }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data?.error ?? 'Could not create project.');
      return;
    }
    setProjects((current) => [{ ...data.project, conversation_count: 0 }, ...current]);
    setProjectName('');
    setProjectDescription('');
    setSelectedProjectId(data.project.id);
    setNotice('Project created.');
  }

  function beginProjectEdit(project: Project) {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setProjectDescription(project.description);
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!editingProjectId) return;
    const response = await fetch(`/api/projects/${editingProjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, description: projectDescription }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data?.error ?? 'Could not update project.');
      return;
    }
    setProjects((current) => current.map((project) => project.id === editingProjectId ? { ...project, ...data.project } : project));
    setEditingProjectId(null);
    setProjectName('');
    setProjectDescription('');
    setNotice('Project updated.');
  }

  async function deleteProject(id: string) {
    const project = projects.find((item) => item.id === id);
    if (!project || !window.confirm(`Delete "${project.name}"? Its conversations will stay in NEXA without a project.`)) return;
    const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setProjects((current) => current.filter((item) => item.id !== id));
    if (selectedProjectId === id) await selectProject(null);
    setNotice('Project deleted.');
  }

  async function renameConversation(id: string) {
    const current = conversations.find((conversation) => conversation.id === id);
    if (!current) return;
    const title = window.prompt('Rename conversation', current.title);
    if (!title?.trim()) return;
    const response = await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (!response.ok) return;
    setConversations((items) => items.map((item) => item.id === id ? { ...item, title: title.trim() } : item));
    setConversationMenuId(null);
  }

  async function deleteConversation(id: string) {
    const current = conversations.find((conversation) => conversation.id === id);
    if (!current || !window.confirm(`Delete "${current.title}"?`)) return;
    const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setConversations((items) => items.filter((item) => item.id !== id));
    if (conversationId === id) newChat();
    setConversationMenuId(null);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  const usagePercent = usage ? Math.min(100, (usage.used / Math.max(usage.limit, 1)) * 100) : 0;

  return (
    <main className="nexa-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">N</div><div className="brand-copy"><b>NEXA</b><span>by CIPHER</span></div></div>
        <nav className="nav">
          <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>⌂ &nbsp; Chat</button>
          <button className={view === 'projects' ? 'active' : ''} onClick={() => setView('projects')}>◫ &nbsp; Projects</button>
          <button onClick={() => fileInputRef.current?.click()}>⌁ &nbsp; Files <span className="nav-live">Live</span></button>
          <button onClick={() => { setView('chat'); setNotice('NEXA can now research, calculate, remember, and create durable artifacts automatically when useful.'); }}>✦ &nbsp; Tools <span className="nav-live">Live</span></button>
          <button className={view === 'memory' ? 'active' : ''} onClick={() => setView('memory')}>◈ &nbsp; Memory <span className="nav-live">Live</span></button>
          <button className={view === 'artifacts' ? 'active' : ''} onClick={() => setView('artifacts')}>▱ &nbsp; Artifacts <span className="nav-live">Live</span></button>
          <button className={view === 'workflows' ? 'active' : ''} onClick={() => setView('workflows')}>◌ &nbsp; Workflows <span className="nav-live">Live</span></button>
          <button className={view === 'activity' ? 'active' : ''} onClick={() => setView('activity')}>◒ &nbsp; Activity <span className="nav-live">Live</span></button>
          <button className={view === 'account' ? 'active' : ''} onClick={() => setView('account')}>◉ &nbsp; Account</button>
        </nav>

        <div className="sidebar-section-head"><span>{selectedProject ? selectedProject.name : 'Recent'}</span><button onClick={() => setView('projects')}>+</button></div>
        <div className="conversation-list">
          {conversations.slice(0, 12).map((conversation) => (
            <div className="conversation-wrap" key={conversation.id}>
              <button className={`conversation-item ${conversation.id === conversationId ? 'selected' : ''}`} onClick={() => void openConversation(conversation.id)}>{conversation.title}</button>
              <button className="conversation-more" aria-label={`Manage ${conversation.title}`} onClick={() => setConversationMenuId(conversationMenuId === conversation.id ? null : conversation.id)}>•••</button>
              {conversationMenuId === conversation.id && (
                <div className="conversation-menu">
                  <button onClick={() => void renameConversation(conversation.id)}>Rename</button>
                  <button onClick={() => void deleteConversation(conversation.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
          {conversations.length === 0 && <div className="sidebar-empty">No conversations here yet.</div>}
        </div>

        <div className="sidebar-spacer" />
        <div className="plan-card">
          <div className="plan-top"><b>{user.plan === 'premium' ? 'NEXA Premium' : 'NEXA Free'}</b><span>{usage ? `${usage.remaining} left` : '—'}</span></div>
          <div className="usage-track"><span style={{ width: `${usagePercent}%` }} /></div>
          <p>{usage ? `${usage.used} of ${usage.limit} daily messages used.` : 'Usage loads from your NEXA account.'}</p>
        </div>
        <div className="account-row"><div className="account-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><b>{user.name}</b><span>{user.email}</span></div><div className="account-actions"><button onClick={() => setView('account')} aria-label="Account settings">⚙</button><button onClick={() => void logout()} aria-label="Sign out">↪</button></div></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="status"><span className="dot" /> NEXA agent online</div>
          <div className="top-context">{selectedProject && <><span className="context-label">Project</span><b>{selectedProject.name}</b></>}</div>
          <div className="top-actions"><button className="icon-btn" aria-label="Account" onClick={() => setView('account')}>◉</button><button className="icon-btn" aria-label="Project files" onClick={() => setView('files')}>⌑</button><button className="icon-btn" aria-label="Artifacts" onClick={() => setView('artifacts')}>▱</button><button className="icon-btn" aria-label="Memory" onClick={() => setView('memory')}>◈</button><button className="icon-btn" aria-label="New chat" onClick={newChat}>＋</button></div>
        </header>

        {view === 'activity' ? (
          <ActivityPanel conversationId={conversationId} />
        ) : view === 'account' ? (
          <AccountPanel user={user} />
        ) : view === 'workflows' ? (
          <WorkflowPanel projectId={selectedProjectId} conversationId={conversationId} onResume={resumeWorkflow} />
        ) : view === 'files' ? (
          <ProjectFilesPanel projectId={selectedProjectId} projectName={selectedProject?.name} />
        ) : view === 'artifacts' ? (
          <ArtifactsPanel projectId={selectedProjectId} conversationId={conversationId} />
        ) : view === 'projects' ? (
          <div className="project-view">
            <div className="project-header">
              <div><span className="hero-badge">NEXA · WORKSPACES</span><h2>Your projects</h2><p>Give related conversations a persistent home. Projects keep conversations, persistent knowledge files, memory, workflows, and artifacts in one isolated workspace.</p></div>
              <button className="primary-btn compact" onClick={() => { setEditingProjectId(null); setProjectName(''); setProjectDescription(''); }}>＋ New project</button>
            </div>
            <div className="project-layout">
              <form className="project-form" onSubmit={editingProjectId ? saveProject : createProject}>
                <span className="section-kicker">{editingProjectId ? 'Edit project' : 'Create project'}</span>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" maxLength={80} />
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What is this project about?" maxLength={300} />
                <div className="form-actions"><button className="primary-btn" type="submit">{editingProjectId ? 'Save changes' : 'Create project'}</button>{editingProjectId && <button className="secondary-btn" type="button" onClick={() => { setEditingProjectId(null); setProjectName(''); setProjectDescription(''); }}>Cancel</button>}</div>
                {notice && <div className="notice">{notice}</div>}
              </form>
              <div className="project-grid">
                {projects.map((project) => (
                  <article className={`project-card ${selectedProjectId === project.id ? 'selected' : ''}`} key={project.id}>
                    <div className="project-orb">N</div>
                    <h3>{project.name}</h3>
                    <p>{project.description || 'A NEXA workspace ready for conversations and future capabilities.'}</p>
                    <div className="project-meta"><span>{project.conversation_count ?? 0} conversations</span><span>{project.file_count ?? 0} files</span></div>
                    <div className="project-actions"><button className="secondary-btn" onClick={() => void selectProject(project.id)}>Open</button><button className="ghost-btn" onClick={() => beginProjectEdit(project)}>Edit</button><button className="ghost-btn danger" onClick={() => void deleteProject(project.id)}>Delete</button></div>
                  </article>
                ))}
                {projects.length === 0 && <div className="project-empty"><b>No projects yet.</b><span>Create one and NEXA can keep related work together.</span></div>}
              </div>
            </div>
          </div>
        ) : view === 'memory' ? (
          <MemoryPanel projectId={selectedProjectId} projectName={selectedProject?.name} />
        ) : (
          <div className="content">
            <div className="hero">
              <span className="hero-badge">CIPHER · GENERAL AI</span>
              <h1><span className="gradient-text">Understand. Create. Accomplish.</span></h1>
              <p>{selectedProject ? `Working inside ${selectedProject.name}. New conversations will stay attached to this project.` : 'NEXA is the intelligence layer of CIPHER — designed to help you think clearly, build boldly, and get things done.'}</p>
            </div>

            <div className="chat">
              <div className="messages">
                {messages.length === 0 && <div className="empty">Start with anything. NEXA {NEXA_VERSION} can transcribe voice, research, understand files and images, use tools, remember what you choose, build artifacts, and execute multi-step workflows.</div>}
                {messages.map((message, index) => (
                  <div className={`message ${message.role}`} key={message.id ?? `${message.role}-${index}`}>
                    <div className={`avatar ${message.role}`}>{message.role === 'assistant' ? 'N' : 'YOU'}</div>
                    <div className="message-body">
                      <div className="bubble">{message.content || (loading ? 'Thinking…' : '')}</div>
                      {message.role === 'assistant' && Boolean(message.sources?.length) && (
                        <div className="message-sources">
                          <div className="message-sources-title">Sources used</div>
                          <div className="message-source-list">
                            {message.sources?.map((source) => (
                              <details className="message-source-card" key={`${message.id ?? index}-${source.label}`}>
                                <summary><b>[{source.label}]</b><span>{source.title}</span><em>{source.provider ?? source.retrieval ?? source.sourceType}</em></summary>
                                <p>{source.excerpt}</p>
                                {source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer noopener">Open source</a>}
                              </details>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {messages.length === 0 && <div className="suggestions">{SUGGESTIONS.map(([title, subtitle]) => <button className="suggestion" key={title} onClick={() => setInput(subtitle)}><b>{title}</b><span>{subtitle}</span></button>)}</div>}

              <form className="composer" onSubmit={sendMessage}>
                {selectedFiles.length > 0 && (
                  <div className="attachment-strip">
                    {selectedFiles.map((file) => {
                      const kind = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file';
                      const icon = kind === 'image' ? '▧' : kind === 'pdf' ? '◇' : '📎';
                      return (
                        <button type="button" className="attachment-chip" key={`${file.name}-${file.size}`} onClick={() => setSelectedFiles((files) => files.filter((item) => item !== file))}>
                          {icon} {file.name} <span>{Math.max(1, Math.round(file.size / 1024))} KB</span> ×
                        </button>
                      );
                    })}
                  </div>
                )}
                {voiceDraft && (
                  <div className="voice-draft">
                    <div><span className="voice-dot" /> <b>Voice transcript</b><span>{voiceDraft.language ? voiceDraft.language.toUpperCase() : 'ready'}</span></div>
                    <p>{voiceDraft.transcript}</p>
                    <button type="button" className="ghost-btn" onClick={() => setVoiceDraft(null)}>Remove</button>
                  </div>
                )}
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={recordingVoice ? "Recording…" : transcribingVoice ? "Transcribing voice…" : "Ask NEXA anything..."} aria-label="Message NEXA" disabled={recordingVoice || transcribingVoice} />
                <div className="composer-row"><div className="composer-meta"><button type="button" className="pill" onClick={() => fileInputRef.current?.click()} disabled={recordingVoice || transcribingVoice}>📎 Attach</button><button type="button" className={`pill voice-pill ${recordingVoice ? 'recording' : ''}`} onClick={() => recordingVoice ? stopVoiceRecording() : void startVoiceRecording()} disabled={transcribingVoice || loading}>{recordingVoice ? '■ Stop' : transcribingVoice ? '◌ Transcribing' : '🎙 Voice'}</button><button type="button" className="pill" onClick={() => setView('projects')}>{selectedProject ? `◫ ${selectedProject.name}` : '＋ Project'}</button><span className="pill">⌁ Web + tools</span><span className="pill">◈ Vision + files</span><span className="pill">NEXA {NEXA_VERSION} · Voice + multimodal</span></div><button className="send" type="submit" disabled={!canSend} aria-label="Send">↑</button></div>
                <input ref={fileInputRef} type="file" hidden multiple accept="application/pdf,text/plain,text/markdown,text/csv,application/json,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                  const incoming = Array.from(event.target.files ?? []);
                  setSelectedFiles((current) => [...current, ...incoming].slice(0, 4));
                  event.currentTarget.value = '';
                }} />
              </form>
              <div className="footer-note">NEXA can make mistakes. Check important information before acting on it.</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
