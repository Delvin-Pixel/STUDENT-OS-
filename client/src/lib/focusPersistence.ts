import type { StudyState } from "./types";

type FocusPhase = "focus" | "break";

export type PersistedFocusTimer = {
  sessionId: string;
  phase: FocusPhase;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt?: number;
  endsAt?: number;
  running: boolean;
  subject: string;
  taskId: string;
  topicId: string;
  objective: string;
};

const KEY_PREFIX = "studentos:focus-timer:v1:";

function key(scope: string) {
  return `${KEY_PREFIX}${encodeURIComponent(scope)}`;
}

function valid(value: unknown): value is PersistedFocusTimer {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedFocusTimer>;
  const durationSeconds =
    typeof candidate.durationSeconds === "number"
      ? candidate.durationSeconds
      : -1;
  const remainingSeconds =
    typeof candidate.remainingSeconds === "number"
      ? candidate.remainingSeconds
      : -1;
  return (
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.length > 0 &&
    (candidate.phase === "focus" || candidate.phase === "break") &&
    Number.isInteger(durationSeconds) &&
    durationSeconds > 0 &&
    durationSeconds <= 14_400 &&
    Number.isInteger(remainingSeconds) &&
    remainingSeconds >= 0 &&
    remainingSeconds <= durationSeconds &&
    typeof candidate.running === "boolean" &&
    typeof candidate.subject === "string" &&
    candidate.subject.length <= 1_000 &&
    typeof candidate.taskId === "string" &&
    candidate.taskId.length <= 160 &&
    typeof candidate.topicId === "string" &&
    candidate.topicId.length <= 160 &&
    typeof candidate.objective === "string" &&
    candidate.objective.length <= 1_000 &&
    (candidate.startedAt === undefined ||
      Number.isFinite(candidate.startedAt)) &&
    (candidate.endsAt === undefined || Number.isFinite(candidate.endsAt))
  );
}

export function loadActiveFocusTimer(
  scope: string
): PersistedFocusTimer | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(scope)) ?? "null");
    if (!valid(parsed)) {
      localStorage.removeItem(key(scope));
      return null;
    }
    if (parsed.running && (!parsed.startedAt || !parsed.endsAt)) {
      localStorage.removeItem(key(scope));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveFocusTimer(
  scope: string,
  timer: PersistedFocusTimer
): boolean {
  if (!valid(timer)) return false;
  try {
    localStorage.setItem(key(scope), JSON.stringify(timer));
    return true;
  } catch {
    return false;
  }
}

export function clearActiveFocusTimer(scope: string): boolean {
  try {
    localStorage.removeItem(key(scope));
    return true;
  } catch {
    return false;
  }
}

export function remainingFromAnchor(
  timer: PersistedFocusTimer,
  now = Date.now()
) {
  if (!timer.running || timer.endsAt === undefined)
    return timer.remainingSeconds;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1_000));
}

export function focusTimerForPrefs(
  scope: string,
  prefs: StudyState["settings"]["timerPrefs"]
): PersistedFocusTimer {
  const durationSeconds = prefs.focus * 60;
  return {
    sessionId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    phase: "focus",
    durationSeconds,
    remainingSeconds: durationSeconds,
    running: false,
    subject: "",
    taskId: "",
    topicId: "",
    objective: "",
  };
}
