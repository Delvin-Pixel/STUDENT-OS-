/* STUDENT OS — local storage layer.
   All data lives in localStorage under a single namespaced key, versioned so
   a future IndexedDB or cloud sync layer can replace this module without
   touching components. */

import {
  validateStudyState,
  validateStudyStateSemantics,
  WORKSPACE_SCHEMA_VERSION,
} from "@shared/workspaceSchema";
import type {
  Achievement,
  AiAnswerFeedbackReason,
  AiAnswerRating,
  StudyState,
} from "./types";

/**
 * v1.5 deliberately starts every pre-no-sign-in installation fresh. A former
 * account-era workspace can otherwise make a shared Chrome/PWA install appear
 * to belong to the previous student. The migration runs exactly once; future
 * visits retain the new device-local workspace under v3.
 */
const LEGACY_KEY = "studentos:data:v3";
const KEY_PREFIX = "studentos:workspace:v4:";
const META_PREFIX = "studentos:workspace-meta:v1:";
const RECOVERY_PREFIX = "studentos:workspace-recovery:v1:";
const CONFLICT_PREFIX = "studentos:workspace-conflict:v1:";
const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const MAX_RECOVERY_RAW_BYTES = 256 * 1024;
const WORKSPACE_OWNER_KEY = "studentos:workspace-owner:v1";
const LEGACY_PERSONAL_DATA_KEYS = [
  "studentos:data:v1",
  "studentos:data:v2",
  WORKSPACE_OWNER_KEY,
  "studentos:reminderSent",
  "studentos:dailyLessons:v1",
  "theme",
  "sidebar-width",
];

const AI_FEEDBACK_REASONS: AiAnswerFeedbackReason[] = [
  "too_vague",
  "missed_question",
  "too_complex",
  "may_be_inaccurate",
  "needs_example",
];

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_session",
    name: "🏆 First Study Session",
    description: "Complete your first study session.",
    unlocked: false,
  },
  {
    id: "streak_7",
    name: "🔥 7 Day Streak",
    description: "Study for seven consecutive days.",
    unlocked: false,
  },
  {
    id: "bookworm",
    name: "📚 Bookworm",
    description: "Complete 25 study sessions.",
    unlocked: false,
  },
  {
    id: "flashcard_master",
    name: "🧠 Flashcard Master",
    description: "Review 500 flashcards.",
    unlocked: false,
  },
  {
    id: "goal_crusher",
    name: "🎯 Goal Crusher",
    description: "Complete 10 goals.",
    unlocked: false,
  },
  {
    id: "focus_master",
    name: "⏱️ Focus Master",
    description: "Complete 50 focus sessions.",
    unlocked: false,
  },
  {
    id: "perfect_week",
    name: "🏅 Perfect Week",
    description: "Complete all planned study sessions for seven days.",
    unlocked: false,
  },
  {
    id: "task_doer",
    name: "✅ Task Doer",
    description: "Complete 20 tasks.",
    unlocked: false,
  },
  {
    id: "xp_500",
    name: "⭐ Rising Star",
    description: "Earn 500 XP.",
    unlocked: false,
  },
];

export const emptyState = (): StudyState => ({
  profile: null,
  onboarded: false,
  transitionDecisionHub: undefined,
  foundationChecks: [],
  tasks: [],
  sessions: [],
  topics: [],
  learningEvidence: [],
  studyPlans: [],
  quizzes: [],
  quizAttempts: [],
  studyMaterials: [],
  decks: [],
  exams: [],
  events: [],
  transactions: [],
  goals: [],
  focusSessions: [],
  notes: [],
  achievements: DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
  notifications: [],
  xp: 0,
  lastActiveDay: "",
  streakDays: 0,
  streakStart: "",
  longestStreak: 0,
  dailyGoal: { targetMinutes: 30 },
  customReminders: [],
  aiAnswerRatings: [],
  settings: {
    theme: "system",
    currency: "GHS",
    timerPrefs: { focus: 25, breakLen: 5, preset: "25/5" },
    notifications: false,
    notificationPreferences: {
      tasks: true,
      exams: true,
      focus: true,
      studyPlan: true,
      dailyGoal: true,
      streak: true,
      savedLessons: true,
      vibrationPattern: "standard",
      categoryVibrationPatterns: {},
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
      dailyCap: 3,
      studyPlanTime: "18:00",
      dailyGoalTime: "19:00",
    },
  },
  habits: [],
  habitLog: {},
  friends: [],
  dailyLessonCompletions: [],
  savedLessons: [],
  syncTombstones: [],
});

function restoreAiAnswerRatings(value: unknown): AiAnswerRating[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<AiAnswerRating>;
    if (
      typeof candidate.answerId !== "string" ||
      (candidate.surface !== "lesson" && candidate.surface !== "assistant") ||
      (candidate.rating !== "up" && candidate.rating !== "down") ||
      typeof candidate.ratedAt !== "string"
    )
      return [];
    return [
      {
        answerId: candidate.answerId,
        surface: candidate.surface,
        rating: candidate.rating,
        ratedAt: candidate.ratedAt,
        // Earlier private ratings intentionally contained no answer text.
        answerPreview:
          typeof candidate.answerPreview === "string"
            ? candidate.answerPreview.slice(0, 1800)
            : "",
        ...(candidate.rating === "down" &&
        AI_FEEDBACK_REASONS.includes(candidate.reason as AiAnswerFeedbackReason)
          ? { reason: candidate.reason as AiAnswerFeedbackReason }
          : {}),
      },
    ];
  });
}

function workspaceKey(openId: string) {
  return `${KEY_PREFIX}${encodeURIComponent(openId)}`;
}

function workspaceMetaKey(openId: string) {
  return `${META_PREFIX}${encodeURIComponent(openId)}`;
}

function workspaceRecoveryKey(openId: string) {
  return `${RECOVERY_PREFIX}${encodeURIComponent(openId)}`;
}

function workspaceConflictKey(openId: string) {
  return `${CONFLICT_PREFIX}${encodeURIComponent(openId)}`;
}

export type WorkspaceCacheMeta = {
  revision: number;
  pending: boolean;
  updatedAt: string;
};
export type WorkspaceRecovery = {
  detectedAt: string;
  reason: "invalid_json" | "invalid_schema";
  rawSnapshot?: string;
};

function recordWorkspaceRecovery(
  openId: string,
  reason: WorkspaceRecovery["reason"],
  raw: string
) {
  try {
    const recovery: WorkspaceRecovery = {
      detectedAt: new Date().toISOString(),
      reason,
      ...(new TextEncoder().encode(raw).byteLength <= MAX_RECOVERY_RAW_BYTES
        ? { rawSnapshot: raw }
        : {}),
    };
    localStorage.setItem(
      workspaceRecoveryKey(openId),
      JSON.stringify(recovery)
    );
  } catch {
    // A blocked/full cache must never prevent cloud hydration or crash the app.
  }
}

export function loadWorkspaceRecovery(
  openId: string
): WorkspaceRecovery | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(workspaceRecoveryKey(openId)) ?? "null"
    ) as Partial<WorkspaceRecovery> | null;
    if (
      !parsed ||
      typeof parsed.detectedAt !== "string" ||
      (parsed.reason !== "invalid_json" && parsed.reason !== "invalid_schema")
    )
      return null;
    return {
      detectedAt: parsed.detectedAt,
      reason: parsed.reason,
      ...(typeof parsed.rawSnapshot === "string"
        ? { rawSnapshot: parsed.rawSnapshot }
        : {}),
    };
  } catch {
    return null;
  }
}

export type WorkspaceConflictRecovery = {
  detectedAt: string;
  remoteRevision: number;
  localWorkspace: string;
};

export function loadWorkspaceConflict(
  openId: string
): WorkspaceConflictRecovery | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(workspaceConflictKey(openId)) ?? "null"
    ) as Partial<WorkspaceConflictRecovery> | null;
    if (
      !parsed ||
      typeof parsed.detectedAt !== "string" ||
      typeof parsed.remoteRevision !== "number" ||
      !Number.isInteger(parsed.remoteRevision) ||
      (parsed.remoteRevision ?? -1) < 0 ||
      typeof parsed.localWorkspace !== "string"
    )
      return null;
    return {
      detectedAt: parsed.detectedAt,
      remoteRevision: parsed.remoteRevision,
      localWorkspace: parsed.localWorkspace,
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceConflict(
  openId: string,
  conflict: WorkspaceConflictRecovery
) {
  try {
    localStorage.setItem(
      workspaceConflictKey(openId),
      JSON.stringify(conflict)
    );
    return true;
  } catch {
    // Never let conflict preservation crash the app. The caller still keeps the
    // authenticated cloud copy and reports the unresolved conflict state.
    return false;
  }
}

export function clearWorkspaceConflict(openId: string) {
  try {
    localStorage.removeItem(workspaceConflictKey(openId));
    return true;
  } catch {
    return false;
  }
}

export function clearWorkspaceRecovery(openId: string) {
  try {
    localStorage.removeItem(workspaceRecoveryKey(openId));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspaceMeta(openId: string): WorkspaceCacheMeta {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(workspaceMetaKey(openId)) ?? "null"
    ) as Partial<WorkspaceCacheMeta> | null;
    return {
      revision:
        Number.isInteger(parsed?.revision) && (parsed?.revision ?? 0) >= 0
          ? parsed!.revision!
          : 0,
      pending: parsed?.pending === true,
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { revision: 0, pending: false, updatedAt: "" };
  }
}

export function saveWorkspaceMeta(openId: string, meta: WorkspaceCacheMeta) {
  try {
    localStorage.setItem(workspaceMetaKey(openId), JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function loadState(openId?: string): StudyState {
  return loadStateWithRecovery(openId).state;
}

export function loadStateWithRecovery(openId?: string): {
  state: StudyState;
  recovery: WorkspaceRecovery | null;
} {
  try {
    if (!openId) {
      // Clear obsolete unscoped data rather than allowing the first account on
      // a shared browser to inherit it. Account caches always require openId.
      LEGACY_PERSONAL_DATA_KEYS.forEach(key => localStorage.removeItem(key));
      return { state: emptyState(), recovery: null };
    }
    const raw = localStorage.getItem(workspaceKey(openId));
    // The user requested a clean onboarding start rather than carrying a prior
    // profile, reminders, or preferences into the new curriculum-aware experience.
    // Only do this destructive migration once; subsequent refreshes preserve a
    // new student's current Student OS session normally.
    if (!raw)
      LEGACY_PERSONAL_DATA_KEYS.filter(
        key => key !== WORKSPACE_OWNER_KEY
      ).forEach(key => localStorage.removeItem(key));
    if (!raw)
      return { state: emptyState(), recovery: loadWorkspaceRecovery(openId) };
    let parsed: StudyState;
    try {
      parsed = JSON.parse(raw) as StudyState;
    } catch {
      recordWorkspaceRecovery(openId, "invalid_json", raw);
      return { state: emptyState(), recovery: loadWorkspaceRecovery(openId) };
    }
    const base = emptyState();
    // merge with defaults so new fields survive upgrades
    const normalized = {
      ...base,
      ...parsed,
      achievements: base.achievements.map(def => {
        const saved = parsed.achievements?.find(a => a.id === def.id);
        return saved ?? def;
      }),
      settings: {
        ...base.settings,
        ...(parsed.settings ?? {}),
        notificationPreferences: {
          ...base.settings.notificationPreferences,
          ...(parsed.settings?.notificationPreferences ?? {}),
          quietHours: {
            ...base.settings.notificationPreferences.quietHours,
            ...(parsed.settings?.notificationPreferences?.quietHours ?? {}),
          },
          categoryVibrationPatterns: {
            ...base.settings.notificationPreferences.categoryVibrationPatterns,
            ...(parsed.settings?.notificationPreferences
              ?.categoryVibrationPatterns ?? {}),
          },
        },
      },
      profile: parsed.profile ?? null,
      longestStreak: Math.max(
        0,
        Number(parsed.longestStreak ?? parsed.streakDays ?? 0)
      ),
      dailyGoal: {
        ...base.dailyGoal,
        ...(parsed.dailyGoal ?? {}),
        targetMinutes: Math.max(
          10,
          Math.min(
            360,
            Number(
              parsed.dailyGoal?.targetMinutes ?? base.dailyGoal.targetMinutes
            )
          )
        ),
      },
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      habitLog: (parsed.habitLog as Record<string, string[]>) ?? {},
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      dailyLessonCompletions: Array.isArray(parsed.dailyLessonCompletions)
        ? parsed.dailyLessonCompletions
        : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      savedLessons: Array.isArray(parsed.savedLessons)
        ? parsed.savedLessons
        : [],
      customReminders: Array.isArray(parsed.customReminders)
        ? parsed.customReminders
        : [],
      aiAnswerRatings: restoreAiAnswerRatings(parsed.aiAnswerRatings),
      studyMaterials: Array.isArray(parsed.studyMaterials)
        ? parsed.studyMaterials.map(material => ({
            ...material,
            // Signed URLs expire; always force a fresh URL after restore.
            url: "",
          }))
        : [],
    } as StudyState;
    const validated = validateStudyState(normalized);
    if (!validated.success) {
      recordWorkspaceRecovery(openId, "invalid_schema", raw);
      return { state: emptyState(), recovery: loadWorkspaceRecovery(openId) };
    }
    return {
      state: validated.data as StudyState,
      recovery: loadWorkspaceRecovery(openId),
    };
  } catch {
    if (openId)
      recordWorkspaceRecovery(
        openId,
        "invalid_schema",
        localStorage.getItem(workspaceKey(openId)) ?? ""
      );
    return {
      state: emptyState(),
      recovery: openId ? loadWorkspaceRecovery(openId) : null,
    };
  }
}

export function saveState(state: StudyState, openId?: string) {
  try {
    if (!openId) return false;
    localStorage.setItem(workspaceKey(openId), JSON.stringify(state));
    return true;
  } catch {
    // storage full or blocked — surface a friendly failure via the app
    console.warn("studentos: failed to save to local storage");
    return false;
  }
}

export function clearState(openId?: string) {
  try {
    if (openId) {
      localStorage.removeItem(workspaceKey(openId));
      localStorage.removeItem(workspaceMetaKey(openId));
      localStorage.removeItem(workspaceRecoveryKey(openId));
      localStorage.removeItem(workspaceConflictKey(openId));
    }
    // The old unscoped key is intentionally not adopted by a new authenticated
    // account: doing so could expose a shared browser's previous student data.
    localStorage.removeItem(LEGACY_KEY);
    LEGACY_PERSONAL_DATA_KEYS.filter(
      key => key !== WORKSPACE_OWNER_KEY
    ).forEach(key => localStorage.removeItem(key));
    return true;
  } catch {
    console.warn("studentos: failed to clear local workspace cache");
    return false;
  }
}

const BACKUP_FORMAT_VERSION = 2;

function toPortableState(state: StudyState): StudyState {
  return {
    ...state,
    // Signed object URLs are short-lived and device/session-specific. Never
    // persist them in a portable backup; the canonical storageKey is enough
    // for the server to mint a fresh private URL after restore.
    studyMaterials: state.studyMaterials.map(material => ({
      ...material,
      url: "",
    })),
  };
}

export function exportData(state: StudyState): string {
  return JSON.stringify(
    {
      format: "student-os-backup",
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      appVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      data: toPortableState(state),
    },
    null,
    2
  );
}

export type ImportDataResult =
  | { state: StudyState; reason: "valid" }
  | { state: null; reason: "too_large" | "invalid_json" | "invalid_schema" };

export function parseImportData(json: string): ImportDataResult {
  try {
    if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES)
      return { state: null, reason: "too_large" };
    const raw = JSON.parse(json);
    if (raw && typeof raw === "object" && "backupFormatVersion" in raw) {
      const version = Number(
        (raw as { backupFormatVersion?: unknown }).backupFormatVersion
      );
      if (
        !Number.isInteger(version) ||
        version < 1 ||
        version > BACKUP_FORMAT_VERSION
      )
        return { state: null, reason: "invalid_schema" };
      if ("format" in raw && raw.format !== "student-os-backup")
        return { state: null, reason: "invalid_schema" };
    }
    const parsed =
      raw && typeof raw === "object" && "data" in raw
        ? (raw as { data: unknown }).data
        : raw;
    if (!parsed || typeof parsed !== "object")
      return { state: null, reason: "invalid_schema" };
    const base = emptyState();
    const normalized = {
      ...base,
      ...parsed,
      achievements: base.achievements.map(def => {
        const saved = (
          parsed.achievements as
            | Array<{ id: string; unlocked: boolean; unlockedAt?: string }>
            | undefined
        )?.find(a => a.id === def.id);
        return saved ?? def;
      }),
      settings: {
        ...base.settings,
        ...(parsed.settings ?? {}),
        notificationPreferences: {
          ...base.settings.notificationPreferences,
          ...(parsed.settings?.notificationPreferences ?? {}),
          quietHours: {
            ...base.settings.notificationPreferences.quietHours,
            ...(parsed.settings?.notificationPreferences?.quietHours ?? {}),
          },
          categoryVibrationPatterns: {
            ...base.settings.notificationPreferences.categoryVibrationPatterns,
            ...(parsed.settings?.notificationPreferences
              ?.categoryVibrationPatterns ?? {}),
          },
        },
      },
      longestStreak: Math.max(
        0,
        Number(parsed.longestStreak ?? parsed.streakDays ?? 0)
      ),
      dailyGoal: {
        ...base.dailyGoal,
        ...(parsed.dailyGoal ?? {}),
        targetMinutes: Math.max(
          10,
          Math.min(
            360,
            Number(
              parsed.dailyGoal?.targetMinutes ?? base.dailyGoal.targetMinutes
            )
          )
        ),
      },
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      savedLessons: Array.isArray(parsed.savedLessons)
        ? parsed.savedLessons
        : [],
      customReminders: Array.isArray(parsed.customReminders)
        ? parsed.customReminders
        : [],
      aiAnswerRatings: restoreAiAnswerRatings(parsed.aiAnswerRatings),
      studyMaterials: Array.isArray(parsed.studyMaterials)
        ? parsed.studyMaterials.map((material: Record<string, unknown>) => ({
            ...material,
            // Signed URLs expire; always force a fresh URL after restore.
            url: "",
          }))
        : [],
    } as StudyState;
    const validated = validateStudyState(normalized);
    if (!validated.success) return { state: null, reason: "invalid_schema" };
    const semantic = validateStudyStateSemantics(validated.data);
    return semantic.success
      ? { state: semantic.data as StudyState, reason: "valid" }
      : { state: null, reason: "invalid_schema" };
  } catch {
    return { state: null, reason: "invalid_json" };
  }
}

export function importData(json: string): StudyState | null {
  return parseImportData(json).state;
}
