'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Activity = {
  id: string;
  kind: 'tool' | 'ai' | 'workflow';
  name: string;
  status: string;
  createdAt: string;
  requestId?: string | null;
  executionAttemptId?: string | null;
  risk?: string | null;
  attempt?: number;
  durationMs?: number | null;
  blockedReason?: string | null;
  stepCount?: number;
  workflowId?: string | null;
  stepOrder?: number | null;
  fromStatus?: string | null;
  toStatus?: string | null;
};

type ActivityResponse = { conversationId: string; projectId: string | null; activity: Activity[]; nextCursor: string | null };
type ExecutionSummary = { conversationId: string; activeAiRuns: number; activeWorkflows: number; recentToolRuns: number; working: boolean; heartbeatGraceMs: number; liveExecutions: Array<{ attemptId: string; workflowId: string; status: string; heartbeatAt: string; leaseExpiresAt: string | null; heartbeatAgeMs: number; leaseRemainingMs: number | null; health: 'healthy' | 'heartbeat_delayed' | 'lease_expired' }>; degradedExecutions: number; liveness: 'healthy' | 'attention' | 'idle' };
type ExecutionAttempt = { id: string; workflowId: string; requestId: string; status: string; terminalReason: string | null; acquiredAt: string; heartbeatAt: string; completedAt: string | null; eventCount: number };
type ExecutionAttemptHistoryResponse = { conversationId: string; attempts: ExecutionAttempt[]; nextCursor: string | null };
type ExecutionAttemptDetail = { id: string; workflowId: string; requestId: string; status: string; terminalReason: string | null; acquiredAt: string; heartbeatAt: string; completedAt: string | null; events: Array<{ id: string; sequenceNo: number; type: string; createdAt: string }>; nextCursor: string | null };
type ExecutionAttemptDetailResponse = { conversationId: string; attempt: ExecutionAttemptDetail };
type ExecutionAttemptTrace = { conversationId: string; snapshotAt: string; attempt: { id: string; workflowId: string; requestId: string; status: string; terminalReason: string | null; acquiredAt: string; heartbeatAt: string; completedAt: string | null }; events: Array<{ id: string; kind: 'lifecycle' | 'ai' | 'tool'; name: string; status: string; createdAt: string; sequenceNo?: number; durationMs?: number | null; stepCount?: number | null; finishReason?: string | null; risk?: string | null; attempt?: number | null; blockedReason?: string | null }>; nextCursor: string | null };
type ActivityTrace = { conversationId: string; requestId: string; attempt: { id: string; status: string; acquiredAt: string; heartbeatAt: string; completedAt: string | null; terminalReason: string | null; events: Array<{ id: string; type: string; createdAt: string }> } | null; events: Array<{ id: string; kind: 'tool' | 'ai'; name: string; status: string; createdAt: string; risk?: string | null; attempt?: number | null; durationMs?: number | null; blockedReason?: string | null; stepCount?: number | null; finishReason?: string | null; workflowId?: string | null; executionAttemptId?: string | null }> };

function label(kind: Activity['kind']) {
  if (kind === 'tool') return 'TOOL';
  if (kind === 'ai') return 'AI RUN';
  return 'WORKFLOW';
}

function prettyName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ActivityPanel({ conversationId }: { conversationId: string | null }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [trace, setTrace] = useState<ActivityTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [attempts, setAttempts] = useState<ExecutionAttempt[]>([]);
  const [attemptsCursor, setAttemptsCursor] = useState<string | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsLoadingOlder, setAttemptsLoadingOlder] = useState(false);
  const [attemptDetail, setAttemptDetail] = useState<ExecutionAttemptDetail | null>(null);
  const [attemptDetailCursor, setAttemptDetailCursor] = useState<string | null>(null);
  const [attemptDetailLoading, setAttemptDetailLoading] = useState(false);
  const [attemptDetailLoadingOlder, setAttemptDetailLoadingOlder] = useState(false);
  const [attemptTrace, setAttemptTrace] = useState<ExecutionAttemptTrace | null>(null);
  const [attemptTraceCursor, setAttemptTraceCursor] = useState<string | null>(null);
  const [attemptTraceLoading, setAttemptTraceLoading] = useState(false);
  const [attemptTraceLoadingOlder, setAttemptTraceLoadingOlder] = useState(false);
  const hasLoadedOlderRef = useRef(false);
  const hasLoadedOlderAttemptsRef = useRef(false);

  const loadSummary = useCallback(async () => {
    if (!conversationId) {
      setSummary(null);
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/activity/summary`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setSummary(data as ExecutionSummary);
    } catch {
      // Activity remains usable even when the lightweight summary is unavailable.
    }
  }, [conversationId]);

  const loadAttempts = useCallback(async () => {
    if (!conversationId) {
      setAttempts([]);
      setAttemptsCursor(null);
      hasLoadedOlderAttemptsRef.current = false;
      return;
    }
    setAttemptsLoading(true);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts?limit=20`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const result = data as ExecutionAttemptHistoryResponse;
      setAttempts(result.attempts ?? []);
      setAttemptsCursor(result.nextCursor ?? null);
      hasLoadedOlderAttemptsRef.current = false;
    } catch {
      // Attempt history is supplementary to the main activity timeline.
    } finally {
      setAttemptsLoading(false);
    }
  }, [conversationId]);

  const refreshLatestAttempts = useCallback(async () => {
    if (!conversationId) return;
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts?limit=20`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const result = data as ExecutionAttemptHistoryResponse;
      setAttempts((current) => {
        const merged = [...(result.attempts ?? []), ...current];
        const seen = new Set<string>();
        return merged
          .filter((attempt) => {
            if (seen.has(attempt.id)) return false;
            seen.add(attempt.id);
            return true;
          })
          .sort((a, b) => {
            const time = new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
            return time || b.id.localeCompare(a.id);
          })
          .slice(0, 300);
      });
      if (!hasLoadedOlderAttemptsRef.current) setAttemptsCursor(result.nextCursor ?? null);
    } catch {
      // Background refresh failure does not disrupt already loaded attempts.
    }
  }, [conversationId]);

  const loadOlderAttempts = useCallback(async () => {
    if (!conversationId || !attemptsCursor || attemptsLoadingOlder) return;
    setAttemptsLoadingOlder(true);
    hasLoadedOlderAttemptsRef.current = true;
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts?limit=20&cursor=${encodeURIComponent(attemptsCursor)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load older execution attempts.');
      const result = data as ExecutionAttemptHistoryResponse;
      setAttempts((current) => {
        const seen = new Set(current.map((attempt) => attempt.id));
        return [...current, ...(result.attempts ?? []).filter((attempt) => !seen.has(attempt.id))];
      });
      setAttemptsCursor(result.nextCursor ?? null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load older execution attempts.');
    } finally {
      setAttemptsLoadingOlder(false);
    }
  }, [conversationId, attemptsCursor, attemptsLoadingOlder]);

  const loadAttemptDetail = useCallback(async (attemptId: string) => {
    if (!conversationId || !attemptId) return;
    setAttemptDetailLoading(true);
    setAttemptDetailLoadingOlder(false);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts/${encodeURIComponent(attemptId)}?limit=50`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load execution attempt.');
      const result = data as ExecutionAttemptDetailResponse;
      setAttemptDetail(result.attempt);
      setAttemptDetailCursor(result.attempt.nextCursor ?? null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load execution attempt.');
    } finally {
      setAttemptDetailLoading(false);
    }
  }, [conversationId]);

  const loadOlderAttemptDetail = useCallback(async () => {
    if (!conversationId || !attemptDetail || !attemptDetailCursor || attemptDetailLoadingOlder) return;
    setAttemptDetailLoadingOlder(true);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts/${encodeURIComponent(attemptDetail.id)}?limit=50&cursor=${encodeURIComponent(attemptDetailCursor)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load older execution attempt events.');
      const result = data as ExecutionAttemptDetailResponse;
      setAttemptDetail((current) => {
        if (!current) return result.attempt;
        const seen = new Set(current.events.map((event) => event.id));
        return { ...current, events: [...current.events, ...(result.attempt.events ?? []).filter((event) => !seen.has(event.id))] };
      });
      setAttemptDetailCursor(result.attempt.nextCursor ?? null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load older execution attempt events.');
    } finally {
      setAttemptDetailLoadingOlder(false);
    }
  }, [conversationId, attemptDetail, attemptDetailCursor, attemptDetailLoadingOlder]);

  const loadAttemptTrace = useCallback(async (attemptId: string) => {
    if (!conversationId || !attemptId) return;
    setAttemptTraceLoading(true);
    setAttemptTraceLoadingOlder(false);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts/${encodeURIComponent(attemptId)}/trace?limit=100`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load execution attempt trace.');
      const result = data as ExecutionAttemptTrace;
      setAttemptTrace(result);
      setAttemptTraceCursor(result.nextCursor ?? null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load execution attempt trace.');
    } finally {
      setAttemptTraceLoading(false);
    }
  }, [conversationId]);

  const loadOlderAttemptTrace = useCallback(async () => {
    if (!conversationId || !attemptTrace || !attemptTraceCursor || attemptTraceLoadingOlder) return;
    setAttemptTraceLoadingOlder(true);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/execution-attempts/${encodeURIComponent(attemptTrace.attempt.id)}/trace?limit=100&cursor=${encodeURIComponent(attemptTraceCursor)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load more execution attempt trace.');
      const result = data as ExecutionAttemptTrace;
      setAttemptTrace((current) => {
        if (!current) return result;
        const seen = new Set(current.events.map((event) => `${event.kind}-${event.id}`));
        return { ...current, events: [...current.events, ...(result.events ?? []).filter((event) => !seen.has(`${event.kind}-${event.id}`))] };
      });
      setAttemptTraceCursor(result.nextCursor ?? null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load more execution attempt trace.');
    } finally {
      setAttemptTraceLoadingOlder(false);
    }
  }, [conversationId, attemptTrace, attemptTraceCursor, attemptTraceLoadingOlder]);

  const loadTrace = useCallback(async (requestId: string) => {
    if (!conversationId || !requestId) return;
    setTraceLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/activity/trace?requestId=${encodeURIComponent(requestId)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load execution trace.');
      setTrace(data as ActivityTrace);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load execution trace.');
    } finally {
      setTraceLoading(false);
    }
  }, [conversationId]);

  const load = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      setNextCursor(null);
      hasLoadedOlderRef.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/activity?limit=60`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load activity.');
      const result = data as ActivityResponse;
      setItems(result.activity ?? []);
      setNextCursor(result.nextCursor ?? null);
      hasLoadedOlderRef.current = false;
      setLastUpdated(Date.now());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const refreshLatest = useCallback(async () => {
    if (!conversationId) return;
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/activity?limit=60`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const result = data as ActivityResponse;
      setItems((current) => {
        const merged = [...(result.activity ?? []), ...current];
        const seen = new Set<string>();
        return merged
          .filter((item) => {
            const key = `${item.kind}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => {
            const time = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return time || b.id.localeCompare(a.id);
          })
          .slice(0, 300);
      });
      if (!hasLoadedOlderRef.current) setNextCursor(result.nextCursor ?? null);
      setLastUpdated(Date.now());
    } catch {
      // Background refresh failure does not disrupt already loaded activity.
    }
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    hasLoadedOlderRef.current = true;
    setError(null);
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/activity?limit=60&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: 'no-store' },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not load older activity.');
      const result = data as ActivityResponse;
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.kind}-${item.id}`));
        const appended = (result.activity ?? []).filter((item) => !seen.has(`${item.kind}-${item.id}`));
        return [...current, ...appended];
      });
      setNextCursor(result.nextCursor ?? null);
      setLastUpdated(Date.now());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load older activity.');
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, nextCursor]);

  useEffect(() => { void load(); void loadSummary(); void loadAttempts(); setTrace(null); setAttemptDetail(null); setAttemptDetailCursor(null); setAttemptTrace(null); setAttemptTraceCursor(null); }, [load, loadSummary, loadAttempts]);

  useEffect(() => {
    if (!conversationId) return;
    const timer = window.setInterval(() => { void refreshLatest(); void loadSummary(); void refreshLatestAttempts(); }, 5000);
    return () => window.clearInterval(timer);
  }, [conversationId, refreshLatest, loadSummary, refreshLatestAttempts]);

  const activityCount = useMemo(() => items.length, [items.length]);

  return (
    <section className="activity-panel" aria-label="Conversation activity">
      <div className="activity-header">
        <div>
          <span className="section-kicker">NEXA · ACTIVITY</span>
          <h2>Execution timeline</h2>
          <p>See what NEXA is doing without exposing private prompts or internal tool payloads.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void load()} disabled={loading || !conversationId}>↻ Refresh</button>
      </div>

      {conversationId && summary && (
        <div className={`activity-summary ${summary.working ? 'working' : ''}`}>
          <strong>{summary.working ? 'NEXA is working' : 'NEXA is idle'}</strong>
          <span>{summary.activeAiRuns} active AI run{summary.activeAiRuns === 1 ? '' : 's'}</span>
          <span>{summary.activeWorkflows} active workflow{summary.activeWorkflows === 1 ? '' : 's'}</span>
          <span>{summary.recentToolRuns} tools in the last 2m</span>
          {summary.liveness === 'attention' && <span className="activity-liveness-alert">Execution needs attention</span>}
          {summary.liveness === 'healthy' && <span className="activity-liveness-ok">Execution heartbeat healthy</span>}
        </div>
      )}

      {conversationId && summary && summary.degradedExecutions > 0 && (
        <div className="activity-empty">
          <b>Execution heartbeat needs attention.</b>
          <span>{summary.degradedExecutions} active execution{summary.degradedExecutions === 1 ? '' : 's'} is not currently reporting a healthy heartbeat or has an expired lease. Operator stale recovery remains the recovery authority.</span>
        </div>
      )}

      {conversationId && (
        <div className="activity-attempt-history" aria-label="Execution attempt history">
          <div className="activity-health-header">
            <strong>Execution attempts</strong>
            <span>{attemptsLoading ? 'Loading…' : `${attempts.length} loaded`}</span>
          </div>
          {attempts.length === 0 && !attemptsLoading ? (
            <div className="activity-trace-empty">No workflow execution attempts recorded.</div>
          ) : (
            <div className="activity-attempt-list">
              {attempts.map((attempt) => (
                <div className="activity-attempt-row" key={attempt.id}>
                  <div>
                    <strong>Attempt {attempt.id.slice(0, 8)}</strong>
                    <span className={`activity-status ${attempt.status}`}>{attempt.status}</span>
                  </div>
                  <div className="activity-meta">
                    <span>{relativeTime(attempt.acquiredAt)}</span>
                    <span>{attempt.eventCount} event{attempt.eventCount === 1 ? '' : 's'}</span>
                    {attempt.completedAt && <span>Ended {relativeTime(attempt.completedAt)}</span>}
                  </div>
                  {attempt.terminalReason && <div className="activity-note">{attempt.terminalReason}</div>}
                  <div className="activity-attempt-actions">
                    <button className="activity-trace-btn" type="button" onClick={() => void loadAttemptDetail(attempt.id)} disabled={attemptDetailLoading}>View attempt details</button>
                    <button className="activity-trace-btn" type="button" onClick={() => void loadTrace(attempt.requestId)} disabled={traceLoading}>View request trace</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {attemptsCursor && <div className="activity-load-more"><button className="secondary-btn" type="button" onClick={() => void loadOlderAttempts()} disabled={attemptsLoadingOlder}>{attemptsLoadingOlder ? 'Loading…' : 'Load older attempts'}</button></div>}
        </div>
      )}

      {conversationId && summary && summary.liveExecutions.length > 0 && (
        <div className="activity-execution-health" aria-label="Execution health">
          <div className="activity-health-header">
            <strong>Live execution health</strong>
            <span>Heartbeat grace {Math.round(summary.heartbeatGraceMs / 1000)}s</span>
          </div>
          {summary.liveExecutions.map((execution) => (
            <div className="activity-health-row" key={execution.attemptId}>
              <span className={`activity-status ${execution.health}`}>{execution.health.replace(/_/g, ' ')}</span>
              <span>Attempt {execution.attemptId.slice(0, 8)}</span>
              <span>Heartbeat {Math.round(execution.heartbeatAgeMs / 1000)}s ago</span>
              <span>{execution.leaseRemainingMs == null ? 'Lease unavailable' : execution.leaseRemainingMs <= 0 ? 'Lease expired' : `Lease ${Math.max(0, Math.round(execution.leaseRemainingMs / 1000))}s`}</span>
            </div>
          ))}
        </div>
      )}

      {attemptDetail && conversationId && (
        <aside className="activity-trace" aria-label="Execution attempt details">
          <div className="activity-trace-header">
            <div>
              <span className="section-kicker">EXECUTION ATTEMPT</span>
              <strong>Attempt {attemptDetail.id.slice(0, 8)}</strong>
              <div className="activity-meta"><span className={`activity-status ${attemptDetail.status}`}>{attemptDetail.status}</span><span>{attemptDetail.events.length} events loaded</span></div>
            </div>
            <button className="secondary-btn" type="button" onClick={() => setAttemptDetail(null)}>Close</button>
          </div>
          <div className="activity-trace-events">
            {attemptDetail.events.map((event) => <span key={event.id}>#{event.sequenceNo} · {event.type} · {relativeTime(event.createdAt)}</span>)}
          </div>
          <div className="activity-attempt-actions">
            <button className="activity-trace-btn" type="button" onClick={() => void loadAttemptTrace(attemptDetail.id)} disabled={attemptTraceLoading}>Open attempt trace</button>
            <button className="activity-trace-btn" type="button" onClick={() => void loadTrace(attemptDetail.requestId)} disabled={traceLoading}>Open request trace</button>
            {attemptDetailCursor && <button className="secondary-btn" type="button" onClick={() => void loadOlderAttemptDetail()} disabled={attemptDetailLoadingOlder}>{attemptDetailLoadingOlder ? 'Loading…' : 'Load older events'}</button>}
          </div>
          {attemptDetail.terminalReason && <div className="activity-note">Terminal reason: {attemptDetail.terminalReason}</div>}
        </aside>
      )}

      {attemptTrace && conversationId && (
        <aside className="activity-trace" aria-label="Execution attempt trace">
          <div className="activity-trace-header">
            <div>
              <span className="section-kicker">ATTEMPT TRACE</span>
              <strong>Attempt {attemptTrace.attempt.id.slice(0, 8)}</strong>
              <div className="activity-meta"><span className={`activity-status ${attemptTrace.attempt.status}`}>{attemptTrace.attempt.status}</span><span>{attemptTrace.events.length} events loaded</span><span>Snapshot {new Date(attemptTrace.snapshotAt).toLocaleTimeString()}</span></div>
            </div>
            <button className="secondary-btn" type="button" onClick={() => setAttemptTrace(null)}>Close</button>
          </div>
          {attemptTrace.events.length === 0 ? (
            <div className="activity-trace-empty">No correlated execution telemetry was recorded for this attempt.</div>
          ) : (
            <div className="activity-trace-list">
              {attemptTrace.events.map((event) => (
                <div className="activity-trace-event" key={`${event.kind}-${event.id}`}>
                  <div className={`activity-kind ${event.kind === 'lifecycle' ? 'workflow' : event.kind}`}>{event.kind === 'lifecycle' ? 'LIFECYCLE' : label(event.kind)}</div>
                  <div>
                    <div className="activity-title"><strong>{prettyName(event.name)}</strong><span>{relativeTime(event.createdAt)}</span></div>
                    <div className="activity-meta">
                      <span className={`activity-status ${event.status}`}>{event.status}</span>
                      {event.sequenceNo != null && <span>#{event.sequenceNo}</span>}
                      {event.risk && <span>{event.risk}</span>}
                      {event.durationMs != null && <span>{event.durationMs}ms</span>}
                      {event.attempt != null && <span>Tool attempt {event.attempt}</span>}
                      {event.stepCount != null && <span>{event.stepCount} steps</span>}
                      {event.finishReason && <span>{event.finishReason}</span>}
                    </div>
                    {event.blockedReason && <div className="activity-note">Blocked: {event.blockedReason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {attemptTraceCursor && <div className="activity-load-more"><button className="secondary-btn" type="button" onClick={() => void loadOlderAttemptTrace()} disabled={attemptTraceLoadingOlder}>{attemptTraceLoadingOlder ? 'Loading…' : 'Load older trace events'}</button></div>}
        </aside>
      )}

      {trace && conversationId && (
        <aside className="activity-trace" aria-label="Execution request trace">
          <div className="activity-trace-header">
            <div>
              <span className="section-kicker">REQUEST TRACE</span>
              <strong>{trace.events.length} correlated execution event{trace.events.length === 1 ? '' : 's'}</strong>
              {trace.attempt && <div className="activity-meta"><span className={`activity-status ${trace.attempt.status}`}>{trace.attempt.status}</span><span>Attempt {trace.attempt.id.slice(0, 8)}</span></div>}
              {trace.attempt?.events.length ? <div className="activity-trace-events">{trace.attempt.events.map((event) => <span key={event.id}>{event.type}</span>)}</div> : null}
            </div>
            <button className="secondary-btn" type="button" onClick={() => setTrace(null)}>Close</button>
          </div>
          {trace.events.length === 0 ? (
            <div className="activity-trace-empty">No AI/tool telemetry was recorded for this request.</div>
          ) : (
            <div className="activity-trace-list">
              {trace.events.map((event) => (
                <div className="activity-trace-event" key={`${event.kind}-${event.id}`}>
                  <div className={`activity-kind ${event.kind}`}>{label(event.kind)}</div>
                  <div>
                    <div className="activity-title"><strong>{prettyName(event.name)}</strong><span>{relativeTime(event.createdAt)}</span></div>
                    <div className="activity-meta">
                      <span className={`activity-status ${event.status}`}>{event.status}</span>
                      {event.risk && <span>{event.risk}</span>}
                      {event.durationMs != null && <span>{event.durationMs}ms</span>}
                      {event.attempt != null && <span>Attempt {event.attempt}</span>}
                      {event.stepCount != null && <span>{event.stepCount} steps</span>}
                      {event.executionAttemptId && <span>Attempt {event.executionAttemptId.slice(0, 8)}</span>}
                    </div>
                    {event.blockedReason && <div className="activity-note">Blocked: {event.blockedReason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      {!conversationId ? (
        <div className="activity-empty"><b>Open a conversation</b><span>Execution activity appears here while NEXA researches, thinks, and runs workflows.</span></div>
      ) : error ? (
        <div className="activity-empty"><b>Activity is temporarily unavailable.</b><span>{error}</span><button className="secondary-btn" type="button" onClick={() => void load()}>Try again</button></div>
      ) : items.length === 0 && !loading ? (
        <div className="activity-empty"><b>No execution activity yet.</b><span>Send a message and the timeline will populate as NEXA works.</span></div>
      ) : (
        <div className="activity-list">
          {items.map((item) => (
            <article className="activity-item" key={`${item.kind}-${item.id}`}>
              <div className={`activity-kind ${item.kind}`}>{label(item.kind)}</div>
              <div className="activity-main">
                <div className="activity-title"><strong>{prettyName(item.name)}</strong><span>{relativeTime(item.createdAt)}</span></div>
                <div className="activity-meta">
                  <span className={`activity-status ${item.status}`}>{item.status}</span>
                  {item.kind === 'tool' && item.risk && <span>{item.risk}</span>}
                  {item.kind === 'tool' && item.durationMs != null && <span>{item.durationMs}ms</span>}
                  {item.kind === 'ai' && item.stepCount != null && <span>{item.stepCount} steps</span>}
                  {item.kind === 'workflow' && item.stepOrder != null && <span>Step {item.stepOrder}</span>}
                </div>
                {item.blockedReason && <div className="activity-note">Blocked: {item.blockedReason}</div>}
                {item.requestId && (item.kind === 'tool' || item.kind === 'ai') && (
                  <button className="activity-trace-btn" type="button" onClick={() => void loadTrace(item.requestId!)} disabled={traceLoading}>
                    {trace?.requestId === item.requestId ? 'Trace selected' : 'View request trace'}
                  </button>
                )}
                {item.fromStatus && item.toStatus && <div className="activity-note">{item.fromStatus} → {item.toStatus}</div>}
              </div>
            </article>
          ))}
        </div>
      )}

      {conversationId && !error && nextCursor && (
        <div className="activity-load-more">
          <button className="secondary-btn" type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>
            {loadingOlder ? 'Loading…' : 'Load older activity'}
          </button>
        </div>
      )}

      <div className="activity-footer">
        <span>{activityCount} recent events</span>
        <span>{loading ? 'Refreshing…' : lastUpdated ? `Updated ${relativeTime(new Date(lastUpdated).toISOString())}` : 'Waiting'}</span>
      </div>
    </section>
  );
}
