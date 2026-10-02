'use client';

import { useEffect, useState } from 'react';

type WorkflowStep = { id: string; step_order: number; title: string; kind: string; status: string };
type ResumeCheckpoint = { id: string; status: 'ready' | 'blocked'; last_error: string | null; state: Record<string, unknown> };
type Workflow = { id: string; title: string; request: string; workflow_type: string; status: string; updated_at: string; metadata?: Record<string, unknown>; steps: WorkflowStep[] };
type WorkflowDetailResponse = { workflow: Workflow | null; resumeCheckpoint: ResumeCheckpoint | null; events: WorkflowEvent[]; executionAttemptId: string | null };
type WorkflowEvent = { id: string; event_type: string; from_status: string | null; to_status: string | null; step_order: number | null; details?: Record<string, unknown>; created_at: string };

const statusLabel: Record<string, string> = {
  queued: 'Queued',
  running: 'Working',
  verifying: 'Verifying',
  completed: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function WorkflowPanel({ projectId, conversationId, onResume }: { projectId?: string | null; conversationId?: string | null; onResume?: (workflowId: string) => void }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [resumeCheckpoint, setResumeCheckpoint] = useState<ResumeCheckpoint | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [executionAttemptId, setExecutionAttemptId] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (conversationId) params.set('conversationId', conversationId);
    const response = await fetch(`/api/workflows?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setWorkflows(data.workflows ?? []);
  }

  async function loadSelected(id: string) {
    const response = await fetch(`/api/workflows/${id}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as WorkflowDetailResponse;
    setSelected(data.workflow ?? null);
    setResumeCheckpoint(data.resumeCheckpoint ?? null);
    setEvents(data.events ?? []);
    setExecutionAttemptId(data.executionAttemptId ?? null);
  }

  useEffect(() => {
    void load();
  }, [projectId, conversationId]);

  useEffect(() => {
    const active = workflows.some((workflow) => ['queued', 'running', 'verifying'].includes(workflow.status));
    if (!active) return;
    const timer = window.setInterval(() => { void load(); }, 1600);
    return () => window.clearInterval(timer);
  }, [workflows]);

  return (
    <section className="workspace-panel">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Agent work</div>
          <h2>Workflows</h2>
        </div>
        <span className="soft-pill">{workflows.length}</span>
      </div>
      {workflows.length === 0 ? (
        <div className="empty-state">Complex tasks you send to NEXA will appear here with their progress and verification state.</div>
      ) : (
        <div className="workflow-grid">
          {workflows.map((workflow) => (
            <button className="workflow-card" key={workflow.id} onClick={() => void loadSelected(workflow.id)} type="button">
              <div className="workflow-card-top">
                <span>{workflow.workflow_type}</span>
                <strong>{statusLabel[workflow.status] ?? workflow.status}</strong>
              </div>
              <div className="workflow-title">{workflow.title}</div>
              <div className="workflow-steps">
                {workflow.steps.map((step) => <span key={step.id} className={`workflow-dot ${step.status}`} title={step.title} />)}
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="workflow-detail">
          <div className="workflow-detail-head">
            <div>
              <div className="eyebrow">{selected.workflow_type}</div>
              <h3>{selected.title}</h3>
            </div>
            <div className="artifact-actions">
              <span className={`status-badge ${selected.status}`}>{statusLabel[selected.status] ?? selected.status}</span>
              {resumeCheckpoint?.status === 'ready' && onResume && selected.status === 'failed' && (
                <button className="secondary-btn" type="button" onClick={() => onResume(selected.id)}>Resume</button>
              )}
              {resumeCheckpoint?.status === 'blocked' && (
                <span className="status-badge failed" title={resumeCheckpoint.last_error ?? undefined}>Intervention needed</span>
              )}
              {['queued','running','verifying'].includes(selected.status) && (
                <button className="ghost-btn danger" type="button" disabled={cancelBusy} onClick={async () => {
                  setCancelBusy(true);
                  try {
                    const suffix = executionAttemptId ? `?attemptId=${encodeURIComponent(executionAttemptId)}` : '';
                    const response = await fetch(`/api/workflows/${selected.id}${suffix}`, { method: 'DELETE' });
                    if (response.ok) { await loadSelected(selected.id); await load(); }
                  } finally { setCancelBusy(false); }
                }}>{cancelBusy ? 'Stopping…' : 'Stop'}</button>
              )}
            </div>
          </div>
          <p className="workflow-request">{selected.request}</p>
          {selected.metadata?.verificationPassed === false && (
            <div className="notice">Verification warning: NEXA completed the workflow, but one or more server-side checks did not pass. Review the result before relying on it.</div>
          )}
          <div className="step-list">
            {selected.steps.map((step) => (
              <div key={step.id} className="step-row">
                <span className={`step-icon ${step.status}`}>{step.status === 'completed' ? '✓' : step.status === 'running' ? '•' : step.status === 'failed' ? '!' : step.status === 'cancelled' ? '×' : '·'}</span>
                <div><strong>{step.title}</strong><span>{statusLabel[step.status] ?? step.status}</span></div>
              </div>
            ))}
          </div>
          {events.length > 0 && (
            <div className="workflow-events">
              <div className="eyebrow">Execution history</div>
              {events.slice(0, 8).map((event) => (
                <div className="workflow-event" key={event.id}>
                  <span className="workflow-event-dot" />
                  <div><strong>{event.event_type.replaceAll('_', ' ')}</strong><span>{event.to_status ? `${event.from_status ? `${event.from_status} → ` : ''}${event.to_status}` : event.step_order ? `Step ${event.step_order}` : 'Workflow event'} · {new Date(event.created_at).toLocaleTimeString()}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
