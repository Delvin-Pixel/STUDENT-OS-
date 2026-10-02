/* STUDENT OS — global state store.
   One React context holds the whole app state, persisted to localStorage on
   every change. Components mutate via the typed action helpers below. */

import {
  academicStageFor,
  confirmGraduationAndTransition,
  createAcademicJourney,
  evaluateAcademicJourney,
} from "@/lib/academicJourney";
import { applyAiAnswerRating } from "@/lib/answerRatings";
import { isValidLocalIsoDate } from "@/lib/calendarValidation";
import {
  areSameCustomReminder,
  normalizeCustomReminder,
} from "@/lib/customReminders";
import { detachExamTopic, removeExamPreservingTopics } from "@/lib/examTopics";
import {
  normalizeNewExam,
  validateNewExam,
  validateNewExamTopicName,
} from "@/lib/examValidation";
import {
  normalizeFocusSessionInput,
  validateFocusSessionInput,
} from "@/lib/focusValidation";
import {
  ensureFoundationChecks,
  markFoundationAssessment,
  markFoundationRemediation,
} from "@/lib/foundationMonitor";
import {
  awardXpState,
  recordActivityState,
  recordDailyLessonCompletion,
} from "@/lib/gamification";
import { validateNewGoal } from "@/lib/goalValidation";
import { toggleHabitCompletion } from "@/lib/habits";
import { rebalanceMissedPlanItems } from "@/lib/learningIntelligence";
import {
  admitMaterialFlashcardDraft,
  type MaterialFlashcardDraft,
} from "@/lib/materialFlashcardDraftValidation";
import {
  hasStudyMaterialStorageKey,
  removeStudyMaterialById,
} from "@/lib/materials";
import {
  normalizeNewStudyMaterial,
  validateNewStudyMaterial,
  type NewStudyMaterial,
} from "@/lib/materialValidation";
import {
  addStudyNote,
  createStudyNote,
  removeStudyNote,
  updateStudyNote,
} from "@/lib/notes";
import { normalizeNoteDraft, validateNoteDraft } from "@/lib/noteValidation";
import { restartOnboardingState } from "@/lib/onboarding";
import { withOnboardingName } from "@/lib/profileCompletion";
import {
  buildQuizAttemptResponses,
  normalizeQuizAnswers,
  scoreQuiz,
} from "@/lib/quizAssessment";
import {
  normalizeNewQuiz,
  validateNewQuiz,
  type NewQuiz,
} from "@/lib/quizValidation";
import { runReminders } from "@/lib/reminders";
import {
  hasActiveSessionOverlap,
  hasRecurringTimetableOverlap,
  hasTimetableEventOverlap,
} from "@/lib/sessionScheduling";
import {
  clearState,
  clearWorkspaceConflict,
  clearWorkspaceRecovery,
  emptyState,
  exportData,
  loadStateWithRecovery,
  loadWorkspaceConflict,
  loadWorkspaceMeta,
  parseImportData,
  saveState,
  saveWorkspaceConflict,
  saveWorkspaceMeta,
} from "@/lib/storage";
import {
  admitPlannedStudySession,
  normalizeStudySessionDraft,
  type NewStudySession,
} from "@/lib/studySessionAdmission";
import {
  recordTaskWork as applyTaskWork,
  getIncompleteTaskDependencies,
} from "@/lib/taskExecution";
import { normalizeNewTask, validateNewTask } from "@/lib/taskValidation";
import {
  normalizeTimetableEventDraft,
  validateTimetableEventDraft,
} from "@/lib/timetableEventValidation";
import { validateNewTransaction } from "@/lib/transactionValidation";
import { trpc } from "@/lib/trpc";
import type {
  AcademicJourney,
  AiAnswerRating,
  CustomReminder,
  Deck,
  Exam,
  Flashcard,
  Goal,
  NotificationPreferences,
  Profile,
  SavedLesson,
  SessionReflection,
  SessionSkipReason,
  StudyNote,
  StudyPlan,
  StudyPlanItem,
  StudySession,
  StudyState,
  Task,
  TimetableEvent,
  Transaction,
  TransitionDecisionHub,
} from "@/lib/types";
import { XP_RULES, todayStr, uid } from "@/lib/utils";
import { chooseHydratedWorkspace } from "@/lib/workspaceHydration";
import { mergeWorkspaceStates } from "@/lib/workspaceMerge";
import {
  preserveDevicePrivateWorkspaceFields,
  projectWorkspaceForCloud,
} from "@/lib/workspacePrivacy";
import {
  SyncTombstoneCapacityError,
  appendRemovedNestedSyncTombstones,
  appendRemovedSyncTombstones,
  appendSyncTombstones,
} from "@/lib/workspaceTombstones";
import {
  WORKSPACE_DECK_LIMIT,
  WORKSPACE_EXAM_LIMIT,
  WORKSPACE_EXAM_TOPIC_LIMIT,
  WORKSPACE_FOCUS_SESSION_LIMIT,
  WORKSPACE_NOTE_LIMIT,
  WORKSPACE_STUDY_MATERIAL_LIMIT,
  WORKSPACE_STUDY_PLAN_ITEM_LIMIT,
  WORKSPACE_TIMETABLE_EVENT_LIMIT,
  validateStudyState,
} from "@shared/workspaceSchema";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type NotificationType = "info" | "success" | "warning";
type NewExam = Omit<Exam, "id" | "topics">;
type EditableExamFields = Pick<
  Exam,
  "subject" | "name" | "date" | "time" | "location" | "notes"
>;
type EditableGoalFields = Pick<
  Goal,
  "name" | "target" | "current" | "deadline" | "category" | "unit" | "completed"
>;
export type WorkspaceSyncStatus =
  | "loading"
  | "synced"
  | "syncing"
  | "offline"
  | "pending"
  | "conflict"
  | "failed"
  | "storage_error"
  | "recovery_required";
const DEFAULT_PROFILE: Profile = {
  name: "",
  studentType: "Other",
  educationLevel: "Other",
  goals: [],
  subjects: [],
  hoursPerDay: "1 hour",
};
const EDUCATION_LEVELS: Profile["educationLevel"][] = [
  "Primary",
  "Lower Secondary",
  "Secondary",
  "Sixth Form / College",
  "Tertiary",
  "Other",
];
const STUDENT_TYPES: Profile["studentType"][] = [
  "Secondary School",
  "University",
  "College",
  "Other",
];

function normalizeProfile(value: Profile): Profile | null {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const hoursPerDay =
    typeof value.hoursPerDay === "string" ? value.hoursPerDay.trim() : "";
  const cleanList = (items: unknown, maximum: number) => {
    if (!Array.isArray(items) || items.length > maximum) return null;
    const result: string[] = [];
    for (const item of items) {
      if (typeof item !== "string") return null;
      const clean = item.trim();
      if (
        !clean ||
        clean.length > 1_000 ||
        result.some(
          current => current.toLocaleLowerCase() === clean.toLocaleLowerCase()
        )
      )
        return null;
      result.push(clean);
    }
    return result;
  };
  const goals = cleanList(value.goals, 20);
  const subjects = cleanList(value.subjects, 30);
  const countryCode = value.countryCode;
  const educationSystem = value.educationSystem;
  const hasValidAcademicContext =
    (!countryCode ||
      (typeof countryCode === "string" &&
        /^[A-Z]{2,8}$/i.test(countryCode.trim()))) &&
    (!educationSystem ||
      (typeof educationSystem === "string" &&
        educationSystem.trim().length > 0 &&
        educationSystem.trim().length <= 160));
  const classLevel = value.classLevel;
  const academicYear = value.academicYear;
  const academicTrack = value.academicTrack;
  const academicSelectionKind = value.academicSelectionKind;
  const hasValidJourneyFields =
    (classLevel === undefined ||
      (typeof classLevel === "string" && classLevel.trim().length <= 80)) &&
    (academicYear === undefined ||
      (typeof academicYear === "string" && academicYear.trim().length <= 80)) &&
    (academicTrack === undefined ||
      (typeof academicTrack === "string" &&
        academicTrack.trim().length <= 120)) &&
    (academicSelectionKind === undefined ||
      academicSelectionKind === "subject" ||
      academicSelectionKind === "course");
  const curriculumContext = value.curriculumContext;
  const hasValidCurriculumContext =
    !curriculumContext ||
    (typeof curriculumContext.countryCode === "string" &&
      /^[A-Z]{2,8}$/.test(curriculumContext.countryCode) &&
      typeof curriculumContext.educationSystem === "string" &&
      curriculumContext.educationSystem.trim().length > 0 &&
      curriculumContext.educationSystem.length <= 160 &&
      typeof curriculumContext.catalogueId === "string" &&
      curriculumContext.catalogueId.trim().length > 0 &&
      curriculumContext.catalogueId.length <= 160 &&
      typeof curriculumContext.catalogueVersion === "string" &&
      curriculumContext.catalogueVersion.trim().length > 0 &&
      curriculumContext.catalogueVersion.length <= 64 &&
      typeof curriculumContext.sourceUrl === "string" &&
      curriculumContext.sourceUrl.length <= 2_048 &&
      (() => {
        try {
          return new URL(curriculumContext.sourceUrl).protocol === "https:";
        } catch {
          return false;
        }
      })());
  const subjectProvenance = value.subjectProvenance;
  const hasValidSubjectProvenance =
    !subjectProvenance ||
    (subjects !== null &&
      Object.keys(subjectProvenance).length <= subjects.length &&
      Object.entries(subjectProvenance).every(([label, provenance]) => {
        const linkedSubject = subjects.find(subject => subject === label);
        if (
          !linkedSubject ||
          !provenance ||
          !["catalogue", "custom", "unclassified"].includes(provenance.kind)
        )
          return false;
        if (provenance.kind === "catalogue")
          return Boolean(
            curriculumContext &&
            typeof provenance.catalogueSubjectId === "string" &&
            provenance.catalogueSubjectId.length > 0 &&
            provenance.catalogueSubjectId.length <= 160
          );
        return provenance.catalogueSubjectId === undefined;
      }));
  if (
    !name ||
    name.length > 120 ||
    !hoursPerDay ||
    hoursPerDay.length > 80 ||
    !STUDENT_TYPES.includes(value.studentType) ||
    !EDUCATION_LEVELS.includes(value.educationLevel) ||
    !goals ||
    !subjects ||
    !hasValidAcademicContext ||
    !hasValidCurriculumContext ||
    !hasValidSubjectProvenance ||
    !hasValidJourneyFields ||
    (value.age !== undefined &&
      (!Number.isInteger(value.age) || value.age < 3 || value.age > 120)) ||
    (value.profilePhotoStorageKey !== undefined &&
      (typeof value.profilePhotoStorageKey !== "string" ||
        !value.profilePhotoStorageKey ||
        value.profilePhotoStorageKey.length > 1_024)) ||
    (value.profilePhotoUrl !== undefined &&
      (typeof value.profilePhotoUrl !== "string" ||
        value.profilePhotoUrl.length > 2_048))
  )
    return null;
  return {
    name,
    studentType: value.studentType,
    educationLevel: value.educationLevel,
    ...(classLevel ? { classLevel: classLevel.trim() } : {}),
    ...(academicYear ? { academicYear: academicYear.trim() } : {}),
    ...(academicTrack ? { academicTrack: academicTrack.trim() } : {}),
    ...(academicSelectionKind ? { academicSelectionKind } : {}),
    ...(countryCode ? { countryCode: countryCode.trim().toUpperCase() } : {}),
    ...(educationSystem ? { educationSystem: educationSystem.trim() } : {}),
    goals,
    subjects,
    hoursPerDay,
    ...(value.age !== undefined ? { age: value.age } : {}),
    ...(value.profilePhotoStorageKey
      ? { profilePhotoStorageKey: value.profilePhotoStorageKey }
      : {}),
    ...(value.profilePhotoUrl
      ? { profilePhotoUrl: value.profilePhotoUrl }
      : {}),
    ...(curriculumContext
      ? {
          curriculumContext: {
            ...curriculumContext,
            countryCode: curriculumContext.countryCode.toUpperCase(),
            educationSystem: curriculumContext.educationSystem.trim(),
            catalogueId: curriculumContext.catalogueId.trim(),
            catalogueVersion: curriculumContext.catalogueVersion.trim(),
          },
        }
      : {}),
    ...(subjectProvenance
      ? {
          subjectProvenance: Object.fromEntries(
            Object.entries(subjectProvenance).map(([subject, provenance]) => [
              subject,
              { ...provenance },
            ])
          ),
        }
      : {}),
  };
}

interface StoreValue {
  state: StudyState;
  /** Opaque authenticated namespace for device-local derived caches. */
  accountCacheScope: string;
  /** False only while the device-local workspace is initializing. */
  workspaceReady: boolean;
  /** Learner-facing status for the authenticated local-first workspace. */
  syncStatus: WorkspaceSyncStatus;
  /** True when a malformed local cache was preserved and cloud recovery is unavailable. */
  recoveryRequired: boolean;
  /** True when local changes were preserved after a concurrent cloud revision conflict. */
  syncConflictAvailable: boolean;
  /** Resolve a preserved workspace conflict using the latest cloud revision. */
  resolveWorkspaceConflict: (
    resolution: "cloud" | "local" | "merge"
  ) => Promise<boolean>;
  /** Optimistic in-memory state — components read from here. */
  markOnboarded: (name: string) => boolean;
  setProfile: (patch: Partial<Profile>) => boolean;
  setAcademicJourney: (journey: AcademicJourney) => boolean;
  setTransitionDecisionHub: (hub: TransitionDecisionHub) => boolean;
  confirmAcademicGraduation: (nextProfile: Profile) => boolean;
  /* Tasks */
  addTask: (t: Omit<Task, "id" | "createdAt">) => boolean;
  updateTask: (id: string, patch: Partial<Task>) => boolean;
  deleteTask: (id: string) => void;
  completeTask: (id: string, patch?: Partial<Task>) => boolean;
  recordTaskWork: (
    id: string,
    minutes: number,
    progressPercent?: number
  ) => boolean;
  deferTask: (id: string, until: string, reason: string) => boolean;
  /* Study sessions */
  addSession: (
    s: NewStudySession,
    link?: Pick<StudySession, "planId" | "planItemId">
  ) => boolean;
  updateSession: (id: string, patch: Partial<NewStudySession>) => boolean;
  deleteSession: (id: string) => void;
  startSession: (id: string) => boolean;
  pauseSession: (id: string) => boolean;
  resumeSession: (id: string) => boolean;
  completeSession: (
    id: string,
    actualDuration?: number,
    reflection?: SessionReflection
  ) => boolean;
  skipSession: (id: string, reason: SessionSkipReason) => boolean;
  rescheduleSession: (
    id: string,
    date: string,
    startTime: string,
    reason: string
  ) => boolean;
  createStudyPlan: (
    plan: Omit<StudyPlan, "id" | "createdAt" | "updatedAt" | "items"> & {
      items: Array<Omit<StudyPlanItem, "id" | "createdAt">>;
    }
  ) => boolean;
  setStudyPlanItemStatus: (
    planId: string,
    itemId: string,
    status: StudyPlanItem["status"]
  ) => boolean;
  startStudyPlanItem: (planId: string, itemId: string) => void;
  rebalanceStudyPlan: (planId: string) => void;
  /** Returns the canonical quiz ID only after the local write is accepted. */
  createQuiz: (quiz: NewQuiz) => string | null;
  recordQuizAttempt: (
    quizId: string,
    answers: Record<string, number>
  ) => boolean;
  addStudyMaterial: (material: NewStudyMaterial) => boolean;
  deleteStudyMaterial: (id: string) => void;
  markStudyMaterialAiConsent: (storageKey: string, consentAt: string) => void;
  markStudyMaterialAiPracticeQuestionConsent: (
    storageKey: string,
    consentAt: string
  ) => void;
  saveMaterialFlashcardDraft: (draft: MaterialFlashcardDraft) => boolean;
  /* Decks */
  addDeck: (d: Omit<Deck, "id" | "createdAt" | "cards">) => void;
  updateDeck: (id: string, patch: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  addCard: (deckId: string, card: Omit<Flashcard, "id">) => boolean;
  updateCard: (
    deckId: string,
    cardId: string,
    patch: Partial<Flashcard>
  ) => void;
  deleteCard: (deckId: string, cardId: string) => void;
  /* Exams */
  addExam: (e: NewExam) => boolean;
  updateExam: (id: string, patch: Partial<EditableExamFields>) => boolean;
  deleteExam: (id: string) => void;
  addExamTopic: (examId: string, name: string) => boolean;
  deleteExamTopic: (examId: string, topicId: string) => void;
  setTopicStatus: (
    examId: string,
    topicId: string,
    status: "not_started" | "learning" | "revised" | "mastered"
  ) => void;
  /* Events */
  addEvent: (e: Omit<TimetableEvent, "id">) => boolean;
  updateEvent: (
    id: string,
    patch: Partial<Omit<TimetableEvent, "id">>
  ) => boolean;
  deleteEvent: (id: string) => void;
  /* Transactions */
  addTransaction: (t: Omit<Transaction, "id">) => boolean;
  deleteTransaction: (id: string) => void;
  /* Goals */
  addGoal: (g: Omit<Goal, "id" | "completed">) => boolean;
  updateGoal: (id: string, patch: Partial<EditableGoalFields>) => boolean;
  deleteGoal: (id: string) => void;
  bumpGoal: (id: string, by?: number) => boolean;
  completeGoal: (id: string) => void;
  /* Notes */
  addNote: (note: Omit<StudyNote, "id" | "createdAt" | "updatedAt">) => boolean;
  updateNote: (
    id: string,
    patch: Partial<
      Pick<StudyNote, "title" | "subject" | "topicId" | "content" | "pinned">
    >
  ) => boolean;
  deleteNote: (id: string) => void;
  /* Focus */
  addFocusSession: (
    subject: string,
    duration: number,
    objective?: { taskId?: string; topicId?: string; objective?: string }
  ) => boolean;
  /* Habits */
  addHabit: (name: string, emoji: string) => boolean;
  deleteHabit: (id: string) => void;
  toggleHabit: (id: string, date?: string) => void;
  addFriend: (name: string, emoji: string, weeklyBase: number) => void;
  deleteFriend: (id: string) => void;
  /* Notifications */
  notify: (text: string, type?: NotificationType) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  /* Settings */
  setTheme: (theme: "light" | "dark" | "system") => boolean;
  setCurrency: (currency: StudyState["settings"]["currency"]) => boolean;
  setTimerPrefs: (prefs: StudyState["settings"]["timerPrefs"]) => boolean;
  setNotificationsEnabled: (enabled: boolean) => boolean;
  setNotificationPreferences: (
    patch: Partial<NotificationPreferences>
  ) => boolean;
  setDailyGoalTarget: (minutes: number) => void;
  addCustomReminder: (
    reminder: Omit<CustomReminder, "id" | "createdAt">
  ) => boolean;
  updateCustomReminder: (
    id: string,
    patch: Partial<Omit<CustomReminder, "id" | "createdAt">>
  ) => boolean;
  deleteCustomReminder: (id: string) => void;
  rateAiAnswer: (
    answerId: string,
    surface: AiAnswerRating["surface"],
    rating: AiAnswerRating["rating"],
    answerPreview: string,
    reason?: AiAnswerRating["reason"]
  ) => void;
  updateAiAnswerReason: (
    answerId: string,
    surface: AiAnswerRating["surface"],
    reason?: AiAnswerRating["reason"]
  ) => void;
  clearAiAnswerRatings: () => void;
  /* Data */
  exportState: () => string;
  importState: (json: string) => Promise<boolean>;
  /** Refreshes this device cache from the protected cloud workspace without deleting cloud data. */
  resetState: () => Promise<boolean>;
  /** Permanently deletes the authenticated account's cloud workspace and local cache. */
  deleteWorkspaceEverywhere: () => Promise<boolean>;
  restartOnboarding: () => Promise<boolean>;
  completeDailyLesson: (lessonKey: string, lessonTitle: string) => void;
  /* Saved (bookmarked) Daily Lessons */
  saveSavedLesson: (lesson: Omit<SavedLesson, "id" | "savedAt">) => void;
  removeSavedLesson: (id: string) => void;
  /* Streak bookkeeping — call once per meaningful activity */
  logActivity: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function preserveLegacyRewardMarkers(state: StudyState): StudyState {
  const tasks = state.tasks.map(task =>
    task.completedAt && !task.xpAwardedAt
      ? { ...task, xpAwardedAt: task.completedAt }
      : task
  );
  const goals = state.goals.map(goal =>
    goal.completed && !goal.xpAwarded ? { ...goal, xpAwarded: true } : goal
  );
  const tasksChanged = tasks.some((task, index) => task !== state.tasks[index]);
  const goalsChanged = goals.some((goal, index) => goal !== state.goals[index]);
  return tasksChanged || goalsChanged ? { ...state, tasks, goals } : state;
}

export function StoreProvider({
  openId,
  children,
}: {
  openId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<StudyState>(() => emptyState());
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<WorkspaceSyncStatus>("loading");
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [syncConflictAvailable, setSyncConflictAvailable] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const stateRef = useRef(state);
  const lessonCompletionClaimRef = useRef(
    new Set(state.dailyLessonCompletions)
  );
  const savedLessonClaimRef = useRef(
    new Set(state.savedLessons.map(lesson => lesson.selectionKey))
  );
  const taskCompletionClaimRef = useRef(
    new Set(
      state.tasks
        .filter(task => task.status === "completed")
        .map(task => task.id)
    )
  );
  const goalCompletionClaimRef = useRef(
    new Set(state.goals.filter(goal => goal.completed).map(goal => goal.id))
  );
  const sessionCompletionClaimRef = useRef(
    new Set(
      state.sessions
        .filter(session => session.status === "completed")
        .map(session => session.id)
    )
  );
  const planItemActivationClaimRef = useRef(
    new Set(
      state.sessions.flatMap(session =>
        session.planItemId ? [session.planItemId] : []
      )
    )
  );
  const planRebalanceClaimRef = useRef(new Set<string>());
  const revisionRef = useRef(0);
  const skipNextSyncRef = useRef(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncGenerationRef = useRef(0);
  const hydratedAccountRef = useRef<string | null>(null);
  // The server ignores cacheScope for authorization, but the stable identity
  // input prevents React Query from serving Account A's load result to Account B.
  const workspaceQueryInput = useMemo(() => ({ cacheScope: openId }), [openId]);
  const workspaceQuery = trpc.workspace.load.useQuery(workspaceQueryInput, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const saveWorkspace = trpc.workspace.save.useMutation();
  const clearWorkspace = trpc.workspace.clear.useMutation();
  stateRef.current = state;

  useEffect(() => {
    if (
      hydratedAccountRef.current === null ||
      hydratedAccountRef.current === openId
    )
      return;
    syncGenerationRef.current += 1;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    hydratedAccountRef.current = null;
    skipNextSyncRef.current = true;
    const cleared = emptyState();
    stateRef.current = cleared;
    setState(cleared);
    setWorkspaceReady(false);
    setSyncStatus("loading");
  }, [openId]);

  useEffect(() => {
    lessonCompletionClaimRef.current = new Set(state.dailyLessonCompletions);
  }, [state.dailyLessonCompletions]);

  useEffect(() => {
    savedLessonClaimRef.current = new Set(
      state.savedLessons.map(lesson => lesson.selectionKey)
    );
  }, [state.savedLessons]);

  useEffect(() => {
    planItemActivationClaimRef.current = new Set(
      state.sessions.flatMap(session =>
        session.planItemId ? [session.planItemId] : []
      )
    );
  }, [state.sessions]);

  useEffect(() => {
    planRebalanceClaimRef.current.clear();
  }, [state.studyPlans]);

  // Once identity is known, hydrate only that account's cache. A validated cloud
  // copy supersedes a clean cache; unsynced local work is preserved for retry.
  useEffect(() => {
    if (workspaceQuery.isLoading) return;
    const localLoad = loadStateWithRecovery(openId);
    const local = localLoad.state;
    const localMeta = loadWorkspaceMeta(openId);
    const existingConflict = loadWorkspaceConflict(openId);
    const remoteResult = validateStudyState(workspaceQuery.data?.workspace);
    const remote = remoteResult.success
      ? preserveDevicePrivateWorkspaceFields(
          remoteResult.data as StudyState,
          local
        )
      : null;
    revisionRef.current = workspaceQuery.data?.revision ?? 0;
    const hydration = chooseHydratedWorkspace({
      local,
      localMeta,
      remote,
      remoteRevision: workspaceQuery.data?.revision ?? 0,
      online: navigator.onLine,
      remoteAvailable: !workspaceQuery.isError,
    });
    const adopted = preserveLegacyRewardMarkers(hydration.state);
    revisionRef.current = hydration.revision;
    stateRef.current = adopted;
    hydratedAccountRef.current = openId;
    lessonCompletionClaimRef.current = new Set(adopted.dailyLessonCompletions);
    savedLessonClaimRef.current = new Set(
      adopted.savedLessons.map(lesson => lesson.selectionKey)
    );
    taskCompletionClaimRef.current = new Set(
      adopted.tasks
        .filter(task => task.status === "completed")
        .map(task => task.id)
    );
    goalCompletionClaimRef.current = new Set(
      adopted.goals.filter(goal => goal.completed).map(goal => goal.id)
    );
    sessionCompletionClaimRef.current = new Set(
      adopted.sessions
        .filter(session => session.status === "completed")
        .map(session => session.id)
    );
    planItemActivationClaimRef.current = new Set(
      adopted.sessions.flatMap(session =>
        session.planItemId ? [session.planItemId] : []
      )
    );
    skipNextSyncRef.current = true;
    setState(adopted);
    saveState(adopted, openId);
    if (remote && !localMeta.pending)
      saveWorkspaceMeta(openId, {
        revision: revisionRef.current,
        pending: false,
        updatedAt: new Date().toISOString(),
      });
    const cloudRecoveryAvailable =
      !workspaceQuery.isError &&
      (workspaceQuery.data?.workspace == null || Boolean(remote));
    const needsRecovery = Boolean(
      localLoad.recovery && !remote && !cloudRecoveryAvailable
    );
    setRecoveryRequired(needsRecovery);
    setSyncConflictAvailable(Boolean(existingConflict));
    if (remote) clearWorkspaceRecovery(openId);
    setSyncStatus(needsRecovery ? "recovery_required" : hydration.status);
    setWorkspaceReady(true);
  }, [
    openId,
    workspaceQuery.data,
    workspaceQuery.isLoading,
    workspaceQuery.isError,
  ]);

  // Academic journey is evaluated after every hydrated workspace. Detection is advisory:
  // graduation never changes the student's level without an explicit confirmation.
  useEffect(() => {
    if (!workspaceReady || !state.profile || !state.academicJourney) return;
    const evaluated = evaluateAcademicJourney(state.academicJourney);
    const nextFoundationChecks = ensureFoundationChecks(
      state.profile,
      state.foundationChecks ?? []
    );
    if (
      JSON.stringify(evaluated) === JSON.stringify(state.academicJourney) &&
      JSON.stringify(nextFoundationChecks) ===
        JSON.stringify(state.foundationChecks ?? [])
    )
      return;
    setState(prev => ({
      ...prev,
      academicJourney: evaluated,
      foundationChecks: nextFoundationChecks,
    }));
  }, [
    workspaceReady,
    state.profile,
    state.academicJourney,
    state.foundationChecks,
  ]);

  // Persist locally first, then send one consolidated revision-safe cloud write.
  // A failed cloud request never removes the local account cache.
  useEffect(() => {
    if (!workspaceReady || hydratedAccountRef.current !== openId) return;
    if (!saveState(state, openId)) {
      setSyncStatus("storage_error");
      return;
    }
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    saveWorkspaceMeta(openId, {
      revision: revisionRef.current,
      pending: true,
      updatedAt: new Date().toISOString(),
    });
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    setSyncStatus("pending");
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const syncGeneration = syncGenerationRef.current;
      setSyncStatus("syncing");
      try {
        const result = await saveWorkspace.mutateAsync({
          workspace: projectWorkspaceForCloud(stateRef.current),
          revision: revisionRef.current,
        });
        if (syncGeneration !== syncGenerationRef.current) return;
        if (result.success) {
          revisionRef.current = result.revision;
          saveWorkspaceMeta(openId, {
            revision: result.revision,
            pending: false,
            updatedAt: new Date().toISOString(),
          });
          setSyncStatus("synced");
        } else if (result.reason === "conflict") {
          const cloudResult = validateStudyState(result.workspace);
          if (cloudResult.success && typeof result.revision === "number") {
            // Never silently overwrite the remote record with a concurrent local
            // edit. Preserve the exact local payload before adopting the latest
            // server revision so a future conflict-resolution UI can recover it.
            const localPayload = projectWorkspaceForCloud(stateRef.current);
            saveWorkspaceConflict(openId, {
              detectedAt: new Date().toISOString(),
              remoteRevision: result.revision,
              localWorkspace: JSON.stringify(localPayload),
            });
            const remoteState = preserveDevicePrivateWorkspaceFields(
              cloudResult.data as StudyState,
              stateRef.current
            );
            revisionRef.current = result.revision;
            stateRef.current = remoteState;
            saveWorkspaceMeta(openId, {
              revision: result.revision,
              pending: false,
              updatedAt: new Date().toISOString(),
            });
            setState(remoteState);
            setSyncConflictAvailable(true);
            setSyncStatus("conflict");
          } else {
            setSyncStatus("conflict");
          }
        } else {
          setSyncStatus("failed");
        }
      } catch {
        if (syncGeneration !== syncGenerationRef.current) return;
        setSyncStatus(navigator.onLine ? "failed" : "offline");
        if (navigator.onLine) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(
            () => setSyncAttempt(attempt => attempt + 1),
            5_000
          );
        }
      }
    }, 1_000);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [openId, state, workspaceReady, syncAttempt, saveWorkspace]);

  useEffect(() => {
    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    const wakeSync = () => {
      if (!workspaceReady || !navigator.onLine) return;
      if (wakeTimer) clearTimeout(wakeTimer);
      wakeTimer = setTimeout(() => setSyncAttempt(attempt => attempt + 1), 250);
    };

    const handleOnline = () => wakeSync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") wakeSync();
    };
    const handleFocus = () => wakeSync();
    const handlePageShow = () => wakeSync();

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (wakeTimer) clearTimeout(wakeTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [workspaceReady]);

  /* ── browser reminder loop ────────────────────────────────────────
     Re-check tasks/exams for due-today / due-tomorrow / exam milestones
     on boot and every 60s while the tab is visible. Guarded by the
     settings.notifications flag inside runReminders. */
  useEffect(() => {
    if (!workspaceReady) return;
    runReminders(stateRef.current, openId);
    const id = window.setInterval(() => {
      // only poll when the page is visible to avoid wasted wakeups
      if (document.visibilityState === "visible")
        runReminders(stateRef.current, openId);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [openId, workspaceReady]);

  const update = useCallback((fn: (prev: StudyState) => StudyState) => {
    let blockedByDeletionCapacity = false;
    setState(prev => {
      try {
        const next = fn(prev);
        return appendRemovedNestedSyncTombstones(prev, next);
      } catch (error) {
        if (error instanceof SyncTombstoneCapacityError) {
          blockedByDeletionCapacity = true;
          return prev;
        }
        throw error;
      }
    });
    if (blockedByDeletionCapacity) setSyncStatus("storage_error");
  }, []);

  /* ── shared bookkeeping ─────────────────────────────────────────── */

  const notify = useCallback(
    (text: string, type: NotificationType = "info") => {
      update(prev => {
        const allNotifications = [
          { id: uid(), text, type, read: false, createdAt: todayStr() },
          ...prev.notifications,
        ];
        return appendRemovedSyncTombstones(
          {
            ...prev,
            notifications: allNotifications.slice(0, 50),
          },
          "notifications",
          allNotifications,
          allNotifications.slice(0, 50),
          notification => notification.id
        );
      });
    },
    [update]
  );

  const setNotificationsEnabled = useCallback(
    (enabled: boolean) => {
      if (typeof enabled !== "boolean") {
        notify("Choose whether reminders are enabled.", "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        settings: { ...prev.settings, notifications: enabled },
      }));
      return true;
    },
    [update, notify]
  );

  const setNotificationPreferences = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      const current = stateRef.current.settings.notificationPreferences;
      const vibrationPatterns = [
        "off",
        "gentle",
        "standard",
        "strong",
      ] as const;
      const categoryKeys = [
        "tasks",
        "exams",
        "focus",
        "studyPlan",
        "dailyGoal",
        "streak",
        "savedLessons",
        "custom",
      ] as const;
      const isTime = (value: string) =>
        /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
      const categoryVibrationPatterns = Object.fromEntries(
        categoryKeys.flatMap(key => {
          const value =
            patch.categoryVibrationPatterns?.[key] ??
            current.categoryVibrationPatterns[key];
          return value === undefined ? [] : [[key, value]];
        })
      ) as NotificationPreferences["categoryVibrationPatterns"];
      const next: NotificationPreferences = {
        tasks: patch.tasks ?? current.tasks,
        exams: patch.exams ?? current.exams,
        focus: patch.focus ?? current.focus,
        studyPlan: patch.studyPlan ?? current.studyPlan,
        dailyGoal: patch.dailyGoal ?? current.dailyGoal,
        streak: patch.streak ?? current.streak,
        savedLessons: patch.savedLessons ?? current.savedLessons,
        vibrationPattern: patch.vibrationPattern ?? current.vibrationPattern,
        categoryVibrationPatterns,
        quietHours: {
          enabled: patch.quietHours?.enabled ?? current.quietHours.enabled,
          start: patch.quietHours?.start ?? current.quietHours.start,
          end: patch.quietHours?.end ?? current.quietHours.end,
        },
        dailyCap: patch.dailyCap ?? current.dailyCap,
        studyPlanTime: patch.studyPlanTime ?? current.studyPlanTime,
        dailyGoalTime: patch.dailyGoalTime ?? current.dailyGoalTime,
      };
      const booleans = [
        next.tasks,
        next.exams,
        next.focus,
        next.studyPlan,
        next.dailyGoal,
        next.streak,
        next.savedLessons,
        next.quietHours.enabled,
      ];
      if (
        booleans.some(value => typeof value !== "boolean") ||
        !vibrationPatterns.includes(next.vibrationPattern) ||
        Object.values(next.categoryVibrationPatterns).some(
          value => !vibrationPatterns.includes(value)
        ) ||
        !Number.isInteger(next.dailyCap) ||
        next.dailyCap < 1 ||
        next.dailyCap > 6 ||
        !isTime(next.quietHours.start) ||
        !isTime(next.quietHours.end) ||
        !isTime(next.studyPlanTime) ||
        !isTime(next.dailyGoalTime)
      ) {
        notify("Choose valid notification preferences.", "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          notificationPreferences: next,
        },
      }));
      return true;
    },
    [update, notify]
  );

  const setDailyGoalTarget = useCallback(
    (minutes: number) => {
      const targetMinutes = Math.max(
        10,
        Math.min(360, Math.round(minutes) || 30)
      );
      update(prev => ({
        ...prev,
        dailyGoal: { ...prev.dailyGoal, targetMinutes },
      }));
    },
    [update]
  );

  const addCustomReminder = useCallback(
    (reminder: Omit<CustomReminder, "id" | "createdAt">) => {
      const normalized = normalizeCustomReminder(reminder);
      if (!normalized) {
        notify(
          "Add a title, message, and valid schedule for this reminder.",
          "warning"
        );
        return false;
      }
      if (stateRef.current.customReminders.length >= 3) {
        notify(
          "Keep up to three custom reminders so your phone stays focused.",
          "warning"
        );
        return false;
      }
      if (
        stateRef.current.customReminders.some(existing =>
          areSameCustomReminder(existing, normalized)
        )
      ) {
        notify("That custom reminder already exists.", "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        customReminders: [
          ...prev.customReminders,
          { ...normalized, id: uid(), createdAt: new Date().toISOString() },
        ],
      }));
      notify("Custom reminder added.", "success");
      return true;
    },
    [update, notify]
  );

  const updateCustomReminder = useCallback(
    (id: string, patch: Partial<Omit<CustomReminder, "id" | "createdAt">>) => {
      const existing = stateRef.current.customReminders.find(
        reminder => reminder.id === id
      );
      if (!existing) return false;
      const normalized = normalizeCustomReminder({ ...existing, ...patch });
      if (!normalized) {
        notify(
          "Add a title, message, and valid schedule for this reminder.",
          "warning"
        );
        return false;
      }
      if (
        stateRef.current.customReminders.some(
          reminder =>
            reminder.id !== id && areSameCustomReminder(reminder, normalized)
        )
      ) {
        notify("That custom reminder already exists.", "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        customReminders: prev.customReminders.map(reminder =>
          reminder.id === id ? { ...reminder, ...normalized } : reminder
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteCustomReminder = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          {
            ...prev,
            customReminders: prev.customReminders.filter(
              reminder => reminder.id !== id
            ),
          },
          "customReminders",
          [id]
        )
      );
      notify("Custom reminder removed.");
    },
    [update, notify]
  );

  const rateAiAnswer = useCallback(
    (
      answerId: string,
      surface: AiAnswerRating["surface"],
      rating: AiAnswerRating["rating"],
      answerPreview: string,
      reason?: AiAnswerRating["reason"]
    ) => {
      update(prev => {
        const aiAnswerRatings = applyAiAnswerRating(prev.aiAnswerRatings, {
          answerId,
          surface,
          rating,
          answerPreview: answerPreview.slice(0, 1800),
          ...(rating === "down" && reason ? { reason } : {}),
          ratedAt: new Date().toISOString(),
        });
        return appendRemovedSyncTombstones(
          { ...prev, aiAnswerRatings },
          "aiAnswerRatings",
          prev.aiAnswerRatings,
          aiAnswerRatings,
          entry => `${entry.surface}:${entry.answerId}`
        );
      });
      notify(
        rating === "up"
          ? "Thanks — that answer was helpful."
          : "Thanks — we’ll use this feedback to improve Student OS.",
        "success"
      );
    },
    [update, notify]
  );

  const updateAiAnswerReason = useCallback(
    (
      answerId: string,
      surface: AiAnswerRating["surface"],
      reason?: AiAnswerRating["reason"]
    ) => {
      update(prev => ({
        ...prev,
        aiAnswerRatings: prev.aiAnswerRatings.map(entry =>
          entry.answerId === answerId && entry.surface === surface
            ? { ...entry, ...(reason ? { reason } : { reason: undefined }) }
            : entry
        ),
      }));
      notify(
        reason
          ? "Feedback reason saved privately on this device."
          : "Feedback reason removed."
      );
    },
    [update, notify]
  );

  const clearAiAnswerRatings = useCallback(() => {
    update(prev =>
      appendSyncTombstones(
        { ...prev, aiAnswerRatings: [] },
        "aiAnswerRatings",
        prev.aiAnswerRatings.map(entry => `${entry.surface}:${entry.answerId}`)
      )
    );
    notify("Your private AI feedback history was cleared.");
  }, [update, notify]);

  const logActivity = useCallback(() => {
    update(recordActivityState);
  }, [update]);

  const awardXp = useCallback(
    (amount: number) => {
      update(prev => awardXpState(prev, amount));
    },
    [update]
  );

  /* ── onboarding ─────────────────────────────────────────────────── */

  const markOnboarded = useCallback(
    (name: string) => {
      const preview = normalizeProfile(
        withOnboardingName(stateRef.current.profile, DEFAULT_PROFILE, name)
      );
      if (!preview) {
        notify(
          "Choose valid profile details before finishing setup.",
          "warning"
        );
        return false;
      }
      update(prev => {
        const profile = normalizeProfile(
          withOnboardingName(prev.profile, DEFAULT_PROFILE, name)
        );
        if (!profile) return prev;
        const now = new Date();
        return {
          ...prev,
          onboarded: true,
          profile,
          academicJourney:
            prev.academicJourney ?? createAcademicJourney(profile, now),
        };
      });
      return true;
    },
    [update, notify]
  );

  const setProfile = useCallback(
    (patch: Partial<Profile>) => {
      const profile = normalizeProfile({
        ...(stateRef.current.profile ?? DEFAULT_PROFILE),
        ...patch,
      });
      if (!profile) {
        notify("Choose valid profile details before saving them.", "warning");
        return false;
      }
      update(prev => {
        const now = new Date();
        const existingJourney = prev.academicJourney;
        const selectedStage = academicStageFor(profile.educationLevel);
        const journey = existingJourney
          ? existingJourney.current.stage !== selectedStage
            ? createAcademicJourney(profile, now)
            : evaluateAcademicJourney(
                {
                  ...existingJourney,
                  current: {
                    ...existingJourney.current,
                    ...(profile.classLevel
                      ? { classLevel: profile.classLevel }
                      : {}),
                    academicYear:
                      profile.academicYear ??
                      existingJourney.current.academicYear,
                  },
                },
                now
              )
          : prev.onboarded
            ? createAcademicJourney(profile, now)
            : undefined;
        return {
          ...prev,
          profile,
          ...(journey ? { academicJourney: journey } : {}),
        };
      });
      return true;
    },
    [update, notify]
  );

  const setAcademicJourney = useCallback(
    (journey: AcademicJourney) => {
      const checked = evaluateAcademicJourney(journey);
      update(prev => ({ ...prev, academicJourney: checked }));
      return true;
    },
    [update]
  );

  const setTransitionDecisionHub = useCallback(
    (hub: TransitionDecisionHub) => {
      if (
        !hub ||
        hub.results.length > 30 ||
        hub.options.length > 100 ||
        hub.preparationTasks.length > 30
      ) {
        notify("This transition workspace is too large to save.", "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        transitionDecisionHub: {
          ...hub,
          lastUpdatedAt: new Date().toISOString(),
        },
      }));
      return true;
    },
    [update, notify]
  );

  const confirmAcademicGraduation = useCallback(
    (nextProfile: Profile) => {
      const currentJourney = stateRef.current.academicJourney;
      if (!currentJourney) {
        notify(
          "There is no active academic journey to transition from.",
          "warning"
        );
        return false;
      }
      const evaluated = evaluateAcademicJourney(currentJourney);
      if (evaluated.current.status !== "awaiting_confirmation") {
        notify(
          "Student OS is not asking for a graduation confirmation yet.",
          "warning"
        );
        return false;
      }
      const profile = normalizeProfile(nextProfile);
      if (!profile) {
        notify("Choose valid details for your next academic stage.", "warning");
        return false;
      }
      const journey = confirmGraduationAndTransition(evaluated, profile);
      update(prev => ({
        ...prev,
        profile,
        academicJourney: journey,
        transitionDecisionHub: {
          sourceStage: evaluated.current.stage,
          targetStage: journey.current.stage,
          status: "preparing",
          results: [],
          options: [],
          preparationTasks: [],
          lastUpdatedAt: new Date().toISOString(),
        },
        onboarded: true,
      }));
      notify(
        `Congratulations, ${profile.name}. Your next academic chapter is ready.`,
        "success"
      );
      return true;
    },
    [update, notify]
  );

  /* ── tasks ──────────────────────────────────────────────────────── */

  const addTask = useCallback(
    (t: Omit<Task, "id" | "createdAt">) => {
      const normalized = normalizeNewTask(t);
      const validationError = validateNewTask(normalized);
      if (validationError || stateRef.current.tasks.length >= 2_000) {
        notify(
          validationError ??
            "You can save up to 2,000 tasks. Remove one before adding another.",
          "warning"
        );
        return false;
      }
      if (
        normalized.sourceRef &&
        stateRef.current.tasks.some(
          task => task.sourceRef === normalized.sourceRef
        )
      ) {
        notify("That connected task is already on your task list.", "warning");
        return false;
      }
      const linkedTopic = normalized.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === normalized.topicId)
        : undefined;
      if (normalized.topicId && !linkedTopic) {
        notify(
          "This task’s topic is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        tasks: [
          ...prev.tasks,
          {
            ...normalized,
            ...(linkedTopic ? { subject: linkedTopic.subject } : {}),
            id: uid(),
            createdAt: todayStr(),
          },
        ],
      }));
      notify("Task added — one step closer to done.", "success");
      return true;
    },
    [update, notify]
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      const current = stateRef.current.tasks.find(task => task.id === id);
      if (!current || patch.status === "completed") {
        notify(
          current
            ? "Complete tasks through the checked completion action so prerequisites and task steps are verified."
            : "This task is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      const reopening =
        patch.status === "todo" || patch.status === "in_progress";
      const candidate = normalizeNewTask({ ...current, ...patch });
      const validationError = validateNewTask(candidate);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      const linkedTopic = candidate.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === candidate.topicId)
        : undefined;
      if (candidate.topicId && !linkedTopic) {
        notify(
          "This task’s topic is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      if (reopening) taskCompletionClaimRef.current.delete(id);
      update(prev => ({
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === id
            ? {
                ...candidate,
                ...(linkedTopic ? { subject: linkedTopic.subject } : {}),
                id,
                createdAt: current.createdAt,
                ...(reopening ? { completedAt: undefined } : {}),
              }
            : task
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteTask = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, tasks: prev.tasks.filter(t => t.id !== id) },
          "tasks",
          [id]
        )
      );
      notify("Task deleted.");
    },
    [update, notify]
  );

  const completeTask = useCallback(
    (id: string, patch: Partial<Task> = {}) => {
      const task = stateRef.current.tasks.find(
        candidate => candidate.id === id
      );
      if (
        !task ||
        task.status === "completed" ||
        taskCompletionClaimRef.current.has(id)
      )
        return false;
      const candidate = { ...task, ...patch };
      if (
        getIncompleteTaskDependencies(candidate, stateRef.current.tasks).length
      ) {
        notify(
          "Finish the task’s remaining dependencies before marking it complete.",
          "warning"
        );
        return false;
      }
      if (candidate.subtasks?.some(subtask => !subtask.completed)) {
        notify(
          "Finish or remove the remaining task steps before marking this task complete.",
          "warning"
        );
        return false;
      }
      taskCompletionClaimRef.current.add(id);
      const completedAt = new Date().toISOString();
      const shouldAwardXp = !task.xpAwardedAt;
      update(prev => {
        return {
          ...prev,
          tasks: prev.tasks.map(t =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  status: "completed" as const,
                  progressPercent: 100,
                  completedAt,
                  ...(shouldAwardXp ? { xpAwardedAt: completedAt } : {}),
                }
              : t
          ),
        };
      });
      notify(
        shouldAwardXp
          ? `Task complete! +${XP_RULES.task} XP`
          : "Task marked complete again.",
        "success"
      );
      logActivity();
      if (shouldAwardXp) awardXp(XP_RULES.task);
      return true;
    },
    [update, notify, logActivity, awardXp]
  );

  const recordTaskWork = useCallback(
    (id: string, minutes: number, progressPercent?: number) => {
      const task = stateRef.current.tasks.find(
        candidate => candidate.id === id
      );
      if (
        !task ||
        task.status === "completed" ||
        !Number.isFinite(minutes) ||
        (progressPercent !== undefined && !Number.isFinite(progressPercent))
      )
        return false;
      const timestamp = new Date().toISOString();
      update(prev => ({
        ...prev,
        tasks: prev.tasks.map(candidate =>
          candidate.id === id
            ? applyTaskWork(candidate, minutes, timestamp, progressPercent)
            : candidate
        ),
      }));
      notify(
        "Task progress recorded. Time spent is tracked separately from completion.",
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const deferTask = useCallback(
    (id: string, until: string, reason: string) => {
      const task = stateRef.current.tasks.find(
        candidate => candidate.id === id
      );
      if (
        !task ||
        task.status === "completed" ||
        !isValidLocalIsoDate(until) ||
        until <= todayStr()
      )
        return false;
      const recoveryReason =
        reason.trim().slice(0, 1_000) || "Deferred by learner";
      update(prev => ({
        ...prev,
        tasks: prev.tasks.map(candidate =>
          candidate.id === id
            ? { ...candidate, deferredUntil: until, recoveryReason }
            : candidate
        ),
      }));
      notify(
        `Task deferred until ${until}. It will stay visible in recovery, not disappear.`,
        "info"
      );
      return true;
    },
    [update, notify]
  );

  /* ── study sessions ─────────────────────────────────────────────── */

  const addSession = useCallback(
    (
      s: NewStudySession,
      link?: Pick<StudySession, "planId" | "planItemId">
    ) => {
      const admission = admitPlannedStudySession(stateRef.current, s, link);
      if (!admission.accepted) {
        const messages = {
          invalid: "Choose valid study-session details.",
          capacity: "Keep up to 5,000 study sessions in one workspace.",
          stale_topic: "This session’s topic is no longer available.",
          session_overlap:
            "Choose a different time; this study block overlaps an active or planned session.",
          timetable_overlap:
            "Choose a different time; this study block overlaps a recurring timetable event.",
        } as const;
        notify(messages[admission.reason], "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        sessions: [
          ...prev.sessions,
          {
            ...admission.session,
            ...(link
              ? { planId: link.planId, planItemId: link.planItemId }
              : {}),
            id: uid(),
          },
        ],
      }));
      notify("Study session planned.", "success");
      return true;
    },
    [update, notify]
  );

  const updateSession = useCallback(
    (id: string, patch: Partial<NewStudySession>) => {
      const current = stateRef.current.sessions.find(
        session => session.id === id
      );
      if (!current) return false;
      const proposed = normalizeStudySessionDraft({
        subject: current.subject,
        topic: current.topic,
        ...(current.topicId ? { topicId: current.topicId } : {}),
        date: current.date,
        startTime: current.startTime,
        duration: current.duration,
        difficulty: current.difficulty,
        priority: current.priority,
        notes: current.notes,
        status: current.status,
        ...patch,
      });
      if (!proposed || proposed.status !== current.status) {
        notify(
          "Choose valid study-session details. Use the session controls to change its status.",
          "warning"
        );
        return false;
      }
      const linkedTopic = proposed.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === proposed.topicId)
        : undefined;
      if (proposed.topicId && !linkedTopic) {
        notify("This session’s topic is no longer available.", "warning");
        return false;
      }
      if (hasActiveSessionOverlap(stateRef.current.sessions, proposed, id)) {
        notify(
          "Choose a different time; this study block overlaps an active or planned session.",
          "warning"
        );
        return false;
      }
      if (hasRecurringTimetableOverlap(stateRef.current.events, proposed)) {
        notify(
          "Choose a different time; this study block overlaps a recurring timetable event.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === id
            ? {
                ...s,
                ...proposed,
                ...(linkedTopic ? { subject: linkedTopic.subject } : {}),
                id,
              }
            : s
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteSession = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, sessions: prev.sessions.filter(s => s.id !== id) },
          "sessions",
          [id]
        )
      );
      notify("Session deleted.");
    },
    [update, notify]
  );

  const startSession = useCallback(
    (id: string) => {
      const session = stateRef.current.sessions.find(
        candidate => candidate.id === id
      );
      if (!session || session.status !== "planned") return false;
      const timestamp = new Date().toISOString();
      update(prev => ({
        ...prev,
        sessions: prev.sessions.map(candidate =>
          candidate.id === id
            ? {
                ...candidate,
                status: "in_progress" as const,
                startedAt: timestamp,
              }
            : candidate
        ),
      }));
      notify(
        "Study session started. Take one focused step at a time.",
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const pauseSession = useCallback(
    (id: string) => {
      const session = stateRef.current.sessions.find(
        candidate => candidate.id === id
      );
      if (!session || session.status !== "in_progress") return false;
      update(prev => ({
        ...prev,
        sessions: prev.sessions.map(candidate =>
          candidate.id === id
            ? {
                ...candidate,
                status: "paused" as const,
                pausedAt: new Date().toISOString(),
              }
            : candidate
        ),
      }));
      notify("Session paused. Your plan is still here when you are ready.");
      return true;
    },
    [update, notify]
  );

  const resumeSession = useCallback(
    (id: string) => {
      const session = stateRef.current.sessions.find(
        candidate => candidate.id === id
      );
      if (!session || session.status !== "paused") return false;
      update(prev => ({
        ...prev,
        sessions: prev.sessions.map(candidate =>
          candidate.id === id
            ? {
                ...candidate,
                status: "in_progress" as const,
                resumedAt: new Date().toISOString(),
              }
            : candidate
        ),
      }));
      notify("Session resumed.", "success");
      return true;
    },
    [update, notify]
  );

  const completeSession = useCallback(
    (id: string, actualDuration?: number, reflection?: SessionReflection) => {
      const sessionToComplete = stateRef.current.sessions.find(
        candidate => candidate.id === id
      );
      const reflections: SessionReflection[] = [
        "easy",
        "okay",
        "difficult",
        "still_confused",
      ];
      if (
        !sessionToComplete ||
        ["completed", "skipped", "rescheduled"].includes(
          sessionToComplete.status
        ) ||
        sessionCompletionClaimRef.current.has(id) ||
        (actualDuration !== undefined && !Number.isFinite(actualDuration)) ||
        (reflection !== undefined && !reflections.includes(reflection))
      )
        return false;
      sessionCompletionClaimRef.current.add(id);
      const completedDuration = Math.max(
        1,
        Math.min(
          1_440,
          Math.round(
            actualDuration ??
              sessionToComplete.actualDuration ??
              sessionToComplete.duration
          )
        )
      );
      const timestamp = new Date().toISOString();
      update(prev => {
        const sessions = prev.sessions.map(s =>
          s.id === id
            ? {
                ...s,
                status: "completed" as const,
                actualDuration: completedDuration,
                finishedAt: timestamp,
                ...(reflection ? { reflection } : {}),
              }
            : s
        );
        const goals = prev.goals.map(g =>
          g.category === "study" && !g.completed && g.unit === "hours"
            ? {
                ...g,
                current: Math.min(g.target, g.current + completedDuration / 60),
              }
            : g
        );
        const studyPlans =
          sessionToComplete.planId && sessionToComplete.planItemId
            ? prev.studyPlans.map(plan =>
                plan.id !== sessionToComplete.planId
                  ? plan
                  : {
                      ...plan,
                      updatedAt: timestamp,
                      items: plan.items.map(item =>
                        item.id === sessionToComplete.planItemId
                          ? { ...item, status: "completed" as const }
                          : item
                      ),
                    }
              )
            : prev.studyPlans;
        const learningEvidence = sessionToComplete.topicId
          ? [
              ...prev.learningEvidence,
              {
                id: uid(),
                topicId: sessionToComplete.topicId,
                subject: sessionToComplete.subject,
                kind: "study_session" as const,
                minutes: completedDuration,
                sourceId: sessionToComplete.id,
                recordedAt: timestamp,
              },
            ].slice(-20_000)
          : prev.learningEvidence;
        return { ...prev, sessions, goals, studyPlans, learningEvidence };
      });
      notify("Session complete! Progress updated. +20 XP", "success");
      logActivity();
      awardXp(XP_RULES.session);
      return true;
    },
    [update, notify, logActivity, awardXp]
  );

  const skipSession = useCallback(
    (id: string, reason: SessionSkipReason) => {
      const session = stateRef.current.sessions.find(
        candidate => candidate.id === id
      );
      const skipReasons: SessionSkipReason[] = [
        "too_tired",
        "no_time",
        "higher_priority",
        "missing_materials",
        "not_ready",
        "other",
      ];
      if (
        !session ||
        ["completed", "skipped", "rescheduled"].includes(session.status) ||
        !skipReasons.includes(reason)
      )
        return false;
      const timestamp = new Date().toISOString();
      update(prev => ({
        ...prev,
        sessions: prev.sessions.map(candidate =>
          candidate.id === id
            ? { ...candidate, status: "skipped" as const, skipReason: reason }
            : candidate
        ),
        studyPlans:
          session.planId && session.planItemId
            ? prev.studyPlans.map(plan =>
                plan.id !== session.planId
                  ? plan
                  : {
                      ...plan,
                      updatedAt: timestamp,
                      items: plan.items.map(item =>
                        item.id === session.planItemId
                          ? {
                              ...item,
                              status: "skipped" as const,
                              skipReason: reason,
                            }
                          : item
                      ),
                    }
              )
            : prev.studyPlans,
      }));
      notify(
        "Session skipped without changing your learning evidence. You can make a fresh plan when ready."
      );
      return true;
    },
    [update, notify]
  );

  const rescheduleSession = useCallback(
    (id: string, date: string, startTime: string, reason: string) => {
      const session = stateRef.current.sessions.find(
        candidate => candidate.id === id
      );
      if (
        !session ||
        !isValidLocalIsoDate(date) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        typeof reason !== "string"
      )
        return false;
      if (
        hasActiveSessionOverlap(
          stateRef.current.sessions,
          { date, startTime, duration: session.duration },
          id
        )
      ) {
        notify(
          "Choose a different time; this study block overlaps an active or planned session.",
          "warning"
        );
        return false;
      }
      if (
        hasRecurringTimetableOverlap(stateRef.current.events, {
          date,
          startTime,
          duration: session.duration,
        })
      ) {
        notify(
          "Choose a different time; this study block overlaps a recurring timetable event.",
          "warning"
        );
        return false;
      }
      const timestamp = new Date().toISOString();
      const trimmedReason =
        reason.trim().slice(0, 1_000) || "Rescheduled by learner";
      update(prev => ({
        ...prev,
        sessions: prev.sessions.map(candidate =>
          candidate.id === id
            ? {
                ...candidate,
                status: "planned" as const,
                date,
                startTime,
                rescheduleReason: trimmedReason,
                pausedAt: undefined,
                resumedAt: undefined,
              }
            : candidate
        ),
        studyPlans:
          session.planId && session.planItemId
            ? prev.studyPlans.map(plan =>
                plan.id !== session.planId
                  ? plan
                  : {
                      ...plan,
                      updatedAt: timestamp,
                      items: plan.items.map(item =>
                        item.id === session.planItemId
                          ? {
                              ...item,
                              date,
                              startTime,
                              status: "planned" as const,
                              rescheduledAt: timestamp,
                            }
                          : item
                      ),
                    }
              )
            : prev.studyPlans,
      }));
      notify(
        "Session rescheduled. Student OS kept your completed work unchanged.",
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const createStudyPlan = useCallback(
    (
      plan: Omit<StudyPlan, "id" | "createdAt" | "updatedAt" | "items"> & {
        items: Array<Omit<StudyPlanItem, "id" | "createdAt">>;
      }
    ) => {
      const title = typeof plan.title === "string" ? plan.title.trim() : "";
      const knownTopicIds = new Set([
        ...stateRef.current.topics.map(topic => topic.id),
        ...stateRef.current.exams.flatMap(exam =>
          exam.topics.map(topic => topic.id)
        ),
      ]);
      const validPlan =
        title.length > 0 &&
        title.length <= 1_000 &&
        isValidLocalIsoDate(plan.startDate) &&
        isValidLocalIsoDate(plan.endDate) &&
        plan.endDate >= plan.startDate &&
        Number.isInteger(plan.availableMinutesPerDay) &&
        plan.availableMinutesPerDay >= 10 &&
        plan.availableMinutesPerDay <= 720 &&
        Array.isArray(plan.items) &&
        plan.items.length <= WORKSPACE_STUDY_PLAN_ITEM_LIMIT &&
        stateRef.current.studyPlans.length < 100;
      const validItems =
        validPlan &&
        plan.items.every(
          item =>
            typeof item.subject === "string" &&
            item.subject.trim().length > 0 &&
            item.subject.trim().length <= 1_000 &&
            typeof item.topic === "string" &&
            item.topic.trim().length > 0 &&
            item.topic.trim().length <= 1_000 &&
            typeof item.reason === "string" &&
            item.reason.trim().length <= 1_000 &&
            isValidLocalIsoDate(item.date) &&
            item.date >= plan.startDate &&
            item.date <= plan.endDate &&
            /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) &&
            Number.isInteger(item.duration) &&
            item.duration >= 10 &&
            item.duration <= 720 &&
            ["high", "medium", "low"].includes(item.priority) &&
            item.status === "planned" &&
            (!item.topicId || knownTopicIds.has(item.topicId)) &&
            (!item.linkedExamId ||
              stateRef.current.exams.some(
                exam => exam.id === item.linkedExamId
              ))
        );
      if (!validItems) {
        notify(
          "One or more revision-plan sessions are no longer valid.",
          "warning"
        );
        return false;
      }
      const timestamp = new Date().toISOString();
      update(prev => {
        const allPlans = [
          ...prev.studyPlans,
          {
            title,
            startDate: plan.startDate,
            endDate: plan.endDate,
            availableMinutesPerDay: plan.availableMinutesPerDay,
            id: uid(),
            createdAt: timestamp,
            updatedAt: timestamp,
            items: plan.items.map(item => ({
              subject: item.subject.trim(),
              topic: item.topic.trim(),
              ...(item.topicId ? { topicId: item.topicId } : {}),
              date: item.date,
              startTime: item.startTime,
              duration: item.duration,
              priority: item.priority,
              reason: item.reason.trim(),
              status: item.status,
              ...(item.linkedExamId ? { linkedExamId: item.linkedExamId } : {}),
              id: uid(),
              createdAt: timestamp,
            })),
          },
        ];
        const studyPlans = allPlans.slice(-100);
        return appendRemovedSyncTombstones(
          { ...prev, studyPlans },
          "studyPlans",
          allPlans,
          studyPlans,
          entry => entry.id,
          timestamp
        );
      });
      notify("Revision plan saved to your workspace.", "success");
      return true;
    },
    [update, notify]
  );

  const setStudyPlanItemStatus = useCallback(
    (planId: string, itemId: string, status: StudyPlanItem["status"]) => {
      const plan = stateRef.current.studyPlans.find(
        candidate => candidate.id === planId
      );
      if (
        !plan ||
        !plan.items.some(item => item.id === itemId) ||
        !["planned", "completed", "skipped"].includes(status)
      )
        return false;
      update(prev => ({
        ...prev,
        studyPlans: prev.studyPlans.map(plan =>
          plan.id !== planId
            ? plan
            : {
                ...plan,
                updatedAt: new Date().toISOString(),
                items: plan.items.map(item =>
                  item.id === itemId ? { ...item, status } : item
                ),
              }
        ),
      }));
      return true;
    },
    [update]
  );

  const startStudyPlanItem = useCallback(
    (planId: string, itemId: string) => {
      const plan = stateRef.current.studyPlans.find(
        candidate => candidate.id === planId
      );
      const item = plan?.items.find(candidate => candidate.id === itemId);
      if (
        !plan ||
        !item ||
        item.status !== "planned" ||
        planItemActivationClaimRef.current.has(itemId)
      )
        return;
      if (
        stateRef.current.sessions.some(session => session.planItemId === itemId)
      )
        return;
      if (hasActiveSessionOverlap(stateRef.current.sessions, item)) {
        notify(
          "This plan item overlaps an active or planned study session. Reschedule it first.",
          "warning"
        );
        return;
      }
      if (hasRecurringTimetableOverlap(stateRef.current.events, item)) {
        notify(
          "This plan item overlaps a recurring timetable event. Reschedule it first.",
          "warning"
        );
        return;
      }
      const accepted = addSession(
        {
          subject: item.subject,
          topic: item.topic,
          ...(item.topicId ? { topicId: item.topicId } : {}),
          date: item.date,
          startTime: item.startTime,
          duration: item.duration,
          difficulty: item.priority === "high" ? "hard" : "medium",
          priority: item.priority,
          notes: item.reason,
          status: "planned",
        },
        { planId, planItemId: item.id }
      );
      if (accepted) planItemActivationClaimRef.current.add(itemId);
    },
    [addSession, notify]
  );

  const rebalanceStudyPlan = useCallback(
    (planId: string) => {
      const plan = stateRef.current.studyPlans.find(
        candidate => candidate.id === planId
      );
      if (!plan || planRebalanceClaimRef.current.has(planId)) return;
      const result = rebalanceMissedPlanItems(plan, stateRef.current);
      if (result.skippedItemIds.length === 0) {
        notify("There are no missed plan items to rebalance.");
        return;
      }
      planRebalanceClaimRef.current.add(planId);
      const timestamp = new Date().toISOString();
      update(prev => ({
        ...prev,
        studyPlans: prev.studyPlans.map(candidate =>
          candidate.id !== planId
            ? candidate
            : {
                ...candidate,
                updatedAt: timestamp,
                items: [
                  ...candidate.items.map(item =>
                    result.skippedItemIds.includes(item.id)
                      ? { ...item, status: "skipped" as const }
                      : item
                  ),
                  ...result.additions.map(item => ({
                    ...item,
                    id: uid(),
                    createdAt: timestamp,
                  })),
                ],
              }
        ),
      }));
      notify(
        result.unallocatedCount
          ? `${result.additions.length} missed item${result.additions.length === 1 ? "" : "s"} rescheduled. ${result.unallocatedCount} still need more available time.`
          : "Missed plan work was redistributed within your remaining available time.",
        result.unallocatedCount ? "warning" : "success"
      );
    },
    [update, notify]
  );

  const createQuiz = useCallback(
    (quiz: NewQuiz) => {
      const normalizedQuiz = normalizeNewQuiz(quiz);
      const validationError = validateNewQuiz(normalizedQuiz);
      if (validationError) {
        notify(validationError, "warning");
        return null;
      }
      const linkedTopic = normalizedQuiz.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              name: topic.name,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                name: topic.name,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === normalizedQuiz.topicId)
        : undefined;
      if (normalizedQuiz.topicId && !linkedTopic) {
        notify(
          "This quiz topic is no longer available. Your reviewed draft is still here.",
          "warning"
        );
        return null;
      }
      const canonicalQuiz = linkedTopic
        ? {
            ...normalizedQuiz,
            subject: linkedTopic.subject,
            topic: linkedTopic.name,
          }
        : normalizedQuiz;
      const timestamp = new Date().toISOString();
      const quizId = uid();
      update(prev => {
        const allQuizzes = [
          ...prev.quizzes,
          {
            ...canonicalQuiz,
            id: quizId,
            createdAt: timestamp,
            questions: canonicalQuiz.questions.map(question => ({
              ...question,
              id: uid(),
            })),
          },
        ];
        const quizzes = allQuizzes.slice(-1_000);
        return appendRemovedSyncTombstones(
          { ...prev, quizzes },
          "quizzes",
          allQuizzes,
          quizzes,
          entry => entry.id,
          timestamp
        );
      });
      notify(
        "Practice quiz saved. Review every question before you take it.",
        "success"
      );
      return quizId;
    },
    [update, notify]
  );

  const recordQuizAttempt = useCallback(
    (quizId: string, answers: Record<string, number>) => {
      const quiz = stateRef.current.quizzes.find(
        candidate => candidate.id === quizId
      );
      if (!quiz) {
        notify(
          "This quiz is no longer available, so your result was not recorded.",
          "warning"
        );
        return false;
      }
      const normalizedAnswers = normalizeQuizAnswers(quiz, answers);
      if (!normalizedAnswers) {
        notify(
          "Choose one valid answer for every quiz question before finishing.",
          "warning"
        );
        return false;
      }
      const timestamp = new Date().toISOString();
      const outcome = scoreQuiz(quiz, normalizedAnswers);
      const responses = buildQuizAttemptResponses(quiz, normalizedAnswers);
      update(prev => {
        const foundationQuiz =
          quiz.assessmentKind === "foundation" ||
          quiz.assessmentKind === "foundation_remediation"
            ? quiz
            : undefined;
        const allAttempts = [
          ...prev.quizAttempts,
          {
            id: uid(),
            quizId,
            subject: quiz.subject,
            ...(quiz.topicId ? { topicId: quiz.topicId } : {}),
            score: outcome.score,
            correctCount: outcome.correctCount,
            questionCount: outcome.questionCount,
            completedAt: timestamp,
            responses,
          },
        ];
        const quizAttempts = allAttempts.slice(-10_000);
        const allEvidence = quiz.topicId
          ? [
              ...prev.learningEvidence,
              {
                id: uid(),
                topicId: quiz.topicId,
                subject: quiz.subject,
                kind: "quiz" as const,
                score: outcome.score,
                sourceId: quizId,
                recordedAt: timestamp,
              },
            ]
          : prev.learningEvidence;
        const learningEvidence = allEvidence.slice(-20_000);
        const foundationChecks =
          foundationQuiz?.foundationSourceClassLevel &&
          foundationQuiz.currentAcademicClassLevel
            ? (prev.foundationChecks ?? []).map(check =>
                check.subject === foundationQuiz.subject &&
                check.sourceClassLevel ===
                  foundationQuiz.foundationSourceClassLevel &&
                check.currentClassLevel ===
                  foundationQuiz.currentAcademicClassLevel
                  ? quiz.assessmentKind === "foundation_remediation"
                    ? markFoundationRemediation(
                        check,
                        outcome.score,
                        new Date(timestamp),
                        responses
                      )
                    : markFoundationAssessment(
                        check,
                        outcome.score,
                        new Date(timestamp),
                        responses
                      )
                  : check
              )
            : (prev.foundationChecks ?? []);
        const withAttemptTombstones = appendRemovedSyncTombstones(
          { ...prev, quizAttempts, learningEvidence, foundationChecks },
          "quizAttempts",
          allAttempts,
          quizAttempts,
          entry => entry.id,
          timestamp
        );
        return appendRemovedSyncTombstones(
          withAttemptTombstones,
          "learningEvidence",
          allEvidence,
          learningEvidence,
          entry => entry.id,
          timestamp
        );
      });
      notify(
        outcome.score >= 70
          ? `Quiz complete: ${outcome.score}%. Strong work — keep the topic active.`
          : `Quiz complete: ${outcome.score}%. Student OS will prioritise this topic for review.`,
        outcome.score >= 70 ? "success" : "warning"
      );
      logActivity();
      awardXp(Math.max(5, Math.round(outcome.score / 5)));
      return true;
    },
    [update, notify, logActivity, awardXp]
  );

  const addStudyMaterial = useCallback(
    (material: NewStudyMaterial) => {
      const normalizedMaterial = normalizeNewStudyMaterial(material);
      const validationError = validateNewStudyMaterial(normalizedMaterial);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      const linkedTopic = normalizedMaterial.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === normalizedMaterial.topicId)
        : undefined;
      if (normalizedMaterial.topicId && !linkedTopic) {
        notify(
          "This material’s topic is no longer available. Your upload details are still here.",
          "warning"
        );
        return false;
      }
      if (
        hasStudyMaterialStorageKey(
          stateRef.current.studyMaterials,
          normalizedMaterial.storageKey
        )
      ) {
        notify(
          "This uploaded material is already in your workspace. Your upload details are still here.",
          "warning"
        );
        return false;
      }
      if (
        stateRef.current.studyMaterials.length >= WORKSPACE_STUDY_MATERIAL_LIMIT
      ) {
        notify(
          `You can save up to ${WORKSPACE_STUDY_MATERIAL_LIMIT} materials. Remove one before adding another.`,
          "warning"
        );
        return false;
      }
      const canonicalMaterial = linkedTopic
        ? { ...normalizedMaterial, subject: linkedTopic.subject }
        : normalizedMaterial;
      update(prev => ({
        ...prev,
        studyMaterials: [
          ...prev.studyMaterials,
          {
            ...canonicalMaterial,
            id: uid(),
            addedAt: new Date().toISOString(),
          },
        ],
      }));
      notify(
        "Study material saved. AI will not process it unless you explicitly request an action.",
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const deleteStudyMaterial = useCallback(
    (id: string) => {
      update(prev => {
        const studyMaterials = removeStudyMaterialById(prev.studyMaterials, id);
        if (studyMaterials.length === prev.studyMaterials.length) return prev;
        return appendRemovedSyncTombstones(
          { ...prev, studyMaterials },
          "studyMaterials",
          prev.studyMaterials,
          studyMaterials,
          entry => entry.id
        );
      });
      notify(
        "Material removed from this workspace. Its private key is no longer available through Student OS.",
        "success"
      );
    },
    [update, notify]
  );

  const markStudyMaterialAiConsent = useCallback(
    (storageKey: string, consentAt: string) => {
      update(prev => ({
        ...prev,
        studyMaterials: prev.studyMaterials.map(material =>
          material.storageKey === storageKey
            ? { ...material, aiProcessingConsentAt: consentAt }
            : material
        ),
      }));
    },
    [update]
  );

  const markStudyMaterialAiPracticeQuestionConsent = useCallback(
    (storageKey: string, consentAt: string) => {
      update(prev => ({
        ...prev,
        studyMaterials: prev.studyMaterials.map(material =>
          material.storageKey === storageKey
            ? { ...material, aiPracticeQuestionConsentAt: consentAt }
            : material
        ),
      }));
    },
    [update]
  );

  const saveMaterialFlashcardDraft = useCallback(
    (draft: MaterialFlashcardDraft) => {
      const admission = admitMaterialFlashcardDraft(draft, {
        deckCount: stateRef.current.decks.length,
        topics: stateRef.current.topics,
        exams: stateRef.current.exams,
        deckLimit: WORKSPACE_DECK_LIMIT,
      });
      if (!admission.accepted) {
        const messages = {
          invalid: "Review a valid material summary before saving flashcards.",
          stale_topic:
            "This material topic is no longer available. The reviewed summary remains open.",
          deck_capacity: `You can save up to ${WORKSPACE_DECK_LIMIT} flashcard decks. Remove one before saving this summary.`,
        } as const;
        notify(messages[admission.reason], "warning");
        return false;
      }
      const deckId = uid();
      update(prev => ({
        ...prev,
        decks: [
          ...prev.decks,
          {
            id: deckId,
            name: `${admission.draft.title} — review cards`,
            subject: admission.draft.subject,
            ...(admission.draft.topicId
              ? { topicId: admission.draft.topicId }
              : {}),
            createdAt: todayStr(),
            cards: admission.draft.keyIdeas.map((idea, index) => ({
              id: uid(),
              front: `Explain key idea ${index + 1}: ${idea.length > 84 ? `${idea.slice(0, 81)}…` : idea}`,
              back: idea,
              status: "new" as const,
            })),
          },
        ],
      }));
      notify("Reviewed key ideas saved as a flashcard deck.", "success");
      return true;
    },
    [update, notify]
  );

  /* ── decks ──────────────────────────────────────────────────────── */

  const addDeck = useCallback(
    (d: Omit<Deck, "id" | "createdAt" | "cards">) => {
      update(prev => ({
        ...prev,
        decks: [
          ...prev.decks,
          { ...d, id: uid(), cards: [], createdAt: todayStr() },
        ],
      }));
      notify("Deck created — add some cards!", "success");
    },
    [update, notify]
  );

  const updateDeck = useCallback(
    (id: string, patch: Partial<Deck>) => {
      update(prev => ({
        ...prev,
        decks: prev.decks.map(d => (d.id === id ? { ...d, ...patch } : d)),
      }));
    },
    [update]
  );

  const deleteDeck = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, decks: prev.decks.filter(d => d.id !== id) },
          "decks",
          [id]
        )
      );
      notify("Deck deleted.");
    },
    [update, notify]
  );

  const addCard = useCallback(
    (deckId: string, card: Omit<Flashcard, "id">) => {
      if (!stateRef.current.decks.some(deck => deck.id === deckId)) {
        notify(
          "This deck is no longer available. Keep your card text and choose another deck.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        decks: prev.decks.map(d =>
          d.id === deckId
            ? { ...d, cards: [...d.cards, { ...card, id: uid() }] }
            : d
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const updateCard = useCallback(
    (deckId: string, cardId: string, patch: Partial<Flashcard>) => {
      const deck = stateRef.current.decks.find(
        candidate => candidate.id === deckId
      );
      const reviewScore =
        typeof patch.retentionEstimate === "number" && patch.lastReviewedAt
          ? Math.round(patch.retentionEstimate * 100)
          : undefined;
      update(prev => ({
        ...prev,
        decks: prev.decks.map(d =>
          d.id === deckId
            ? {
                ...d,
                cards: d.cards.map(c =>
                  c.id === cardId ? { ...c, ...patch } : c
                ),
              }
            : d
        ),
        learningEvidence:
          deck?.topicId && reviewScore !== undefined
            ? [
                ...prev.learningEvidence,
                {
                  id: uid(),
                  topicId: deck.topicId,
                  subject: deck.subject,
                  kind: "flashcard" as const,
                  score: reviewScore,
                  sourceId: cardId,
                  recordedAt: patch.lastReviewedAt!,
                },
              ].slice(-20_000)
            : prev.learningEvidence,
      }));
    },
    [update]
  );

  const deleteCard = useCallback(
    (deckId: string, cardId: string) => {
      update(prev =>
        appendSyncTombstones(
          {
            ...prev,
            decks: prev.decks.map(d =>
              d.id === deckId
                ? { ...d, cards: d.cards.filter(c => c.id !== cardId) }
                : d
            ),
          },
          "cards",
          [cardId]
        )
      );
    },
    [update]
  );

  /* ── exams ──────────────────────────────────────────────────────── */

  const addExam = useCallback(
    (e: NewExam) => {
      const exam = normalizeNewExam(e);
      const validationError = validateNewExam(exam);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      if (stateRef.current.exams.length >= WORKSPACE_EXAM_LIMIT) {
        notify(
          `You can track up to ${WORKSPACE_EXAM_LIMIT} exams. Remove one before adding another.`,
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        exams: [...prev.exams, { ...exam, id: uid(), topics: [] }],
      }));
      notify("Exam added — countdown started.", "success");
      return true;
    },
    [update, notify]
  );

  const updateExam = useCallback(
    (id: string, patch: Partial<EditableExamFields>) => {
      const current = stateRef.current.exams.find(exam => exam.id === id);
      if (!current) {
        notify(
          "This exam is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      const exam = normalizeNewExam({
        subject: patch.subject ?? current.subject,
        name: patch.name ?? current.name,
        date: patch.date ?? current.date,
        time: patch.time ?? current.time,
        location: patch.location ?? current.location,
        notes: patch.notes ?? current.notes,
      });
      const validationError = validateNewExam(exam);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        exams: prev.exams.map(existing =>
          existing.id === id ? { ...existing, ...exam } : existing
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteExam = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          removeExamPreservingTopics(prev, id, new Date().toISOString()),
          "exams",
          [id]
        )
      );
      notify("Exam deleted.");
    },
    [update, notify]
  );

  const addExamTopic = useCallback(
    (examId: string, name: string) => {
      const topicName = name.trim();
      const validationError = validateNewExamTopicName(topicName);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      const exam = stateRef.current.exams.find(
        currentExam => currentExam.id === examId
      );
      if (!exam) {
        notify(
          "This exam is no longer available. Your topic is still here.",
          "warning"
        );
        return false;
      }
      if (exam.topics.length >= WORKSPACE_EXAM_TOPIC_LIMIT) {
        notify(
          `This exam can have up to ${WORKSPACE_EXAM_TOPIC_LIMIT} topics. Remove one before adding another.`,
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        exams: prev.exams.map(e =>
          e.id === examId
            ? {
                ...e,
                topics: [
                  ...e.topics,
                  { id: uid(), name: topicName, status: "not_started" },
                ],
              }
            : e
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteExamTopic = useCallback(
    (examId: string, topicId: string) => {
      update(prev =>
        detachExamTopic(prev, examId, topicId, new Date().toISOString())
      );
    },
    [update]
  );

  const setTopicStatus = useCallback(
    (
      examId: string,
      topicId: string,
      status: "not_started" | "learning" | "revised" | "mastered"
    ) => {
      update(prev => ({
        ...prev,
        exams: prev.exams.map(exam =>
          exam.id === examId
            ? {
                ...exam,
                topics: exam.topics.map(topic =>
                  topic.id === topicId ? { ...topic, status } : topic
                ),
              }
            : exam
        ),
      }));
    },
    [update]
  );

  /* ── timetable ──────────────────────────────────────────────────── */

  const addEvent = useCallback(
    (e: Omit<TimetableEvent, "id">) => {
      const event = normalizeTimetableEventDraft(e);
      const validationError = validateTimetableEventDraft(event);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      if (stateRef.current.events.length >= WORKSPACE_TIMETABLE_EVENT_LIMIT) {
        notify(
          `You can add up to ${WORKSPACE_TIMETABLE_EVENT_LIMIT.toLocaleString()} timetable events. Remove one before adding another.`,
          "warning"
        );
        return false;
      }
      if (hasTimetableEventOverlap(stateRef.current.events, event)) {
        notify(
          "Choose a different time; this recurring timetable event overlaps an existing weekly block.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        events: [...prev.events, { ...event, id: uid() }],
      }));
      notify("Event added to your week.", "success");
      return true;
    },
    [update, notify]
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<Omit<TimetableEvent, "id">>) => {
      const current = stateRef.current.events.find(event => event.id === id);
      if (!current) return false;
      const proposed = normalizeTimetableEventDraft({ ...current, ...patch });
      const validationError = validateTimetableEventDraft(proposed);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      if (hasTimetableEventOverlap(stateRef.current.events, proposed, id)) {
        notify(
          "Choose a different time; this recurring timetable event overlaps an existing weekly block.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        events: prev.events.map(event =>
          event.id === id ? { ...event, ...proposed } : event
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteEvent = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, events: prev.events.filter(e => e.id !== id) },
          "events",
          [id]
        )
      );
      notify("Event removed.");
    },
    [update, notify]
  );

  /* ── transactions ───────────────────────────────────────────────── */

  const addTransaction = useCallback(
    (t: Omit<Transaction, "id">) => {
      const validationError = validateNewTransaction(t);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      const transaction = { ...t, label: t.label.trim() };
      update(prev => ({
        ...prev,
        transactions: [...prev.transactions, { ...transaction, id: uid() }],
      }));
      notify(
        t.type === "income" ? "Income recorded." : "Expense recorded.",
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, transactions: prev.transactions.filter(t => t.id !== id) },
          "transactions",
          [id]
        )
      );
    },
    [update]
  );

  /* ── goals ──────────────────────────────────────────────────────── */

  const addGoal = useCallback(
    (g: Omit<Goal, "id" | "completed">) => {
      const goal = {
        ...g,
        name: g.name.trim(),
        unit: g.unit.trim(),
        deadline: g.deadline ?? "",
      };
      const validationError = validateNewGoal(goal);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        goals: [...prev.goals, { ...goal, id: uid(), completed: false }],
      }));
      notify("Goal set — go get it!", "success");
      return true;
    },
    [update, notify]
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<EditableGoalFields>) => {
      const current = stateRef.current.goals.find(goal => goal.id === id);
      if (!current) {
        notify("This goal is no longer available.", "warning");
        return false;
      }
      const proposed = {
        name: patch.name ?? current.name,
        target: patch.target ?? current.target,
        current: patch.current ?? current.current,
        deadline: patch.deadline ?? current.deadline ?? "",
        category: patch.category ?? current.category,
        unit: patch.unit ?? current.unit,
      };
      const validationError = validateNewGoal(proposed);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      if (patch.completed === false) goalCompletionClaimRef.current.delete(id);
      update(prev => ({
        ...prev,
        goals: prev.goals.map(goal =>
          goal.id === id
            ? {
                ...goal,
                ...proposed,
                ...(patch.completed === undefined
                  ? {}
                  : { completed: patch.completed }),
              }
            : goal
        ),
      }));
      return true;
    },
    [update, notify]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, goals: prev.goals.filter(g => g.id !== id) },
          "goals",
          [id]
        )
      );
      notify("Goal removed.");
    },
    [update, notify]
  );

  const bumpGoal = useCallback(
    (id: string, by = 1) => {
      const goal = stateRef.current.goals.find(
        candidate => candidate.id === id
      );
      if (!goal || !Number.isFinite(by)) return false;
      update(prev => ({
        ...prev,
        goals: prev.goals.map(g =>
          g.id === id
            ? { ...g, current: Math.max(0, Math.min(g.target, g.current + by)) }
            : g
        ),
      }));
      return true;
    },
    [update]
  );

  const completeGoal = useCallback(
    (id: string) => {
      const goal = stateRef.current.goals.find(
        candidate => candidate.id === id
      );
      if (!goal || goal.completed || goalCompletionClaimRef.current.has(id))
        return;
      goalCompletionClaimRef.current.add(id);
      const shouldAwardXp = !goal.xpAwarded;
      const awardedAt = new Date().toISOString();
      update(prev => ({
        ...prev,
        goals: prev.goals.map(g =>
          g.id === id
            ? {
                ...g,
                completed: true,
                current: g.target,
                ...(shouldAwardXp
                  ? { xpAwarded: true, xpAwardedAt: awardedAt }
                  : {}),
              }
            : g
        ),
      }));
      notify(
        shouldAwardXp
          ? `Goal complete! +${XP_RULES.goal} XP`
          : "Goal marked complete again.",
        "success"
      );
      logActivity();
      if (shouldAwardXp) awardXp(XP_RULES.goal);
    },
    [update, notify, logActivity, awardXp]
  );

  /* ── notes ──────────────────────────────────────────────────────── */

  const addNote = useCallback(
    (note: Omit<StudyNote, "id" | "createdAt" | "updatedAt">) => {
      const normalizedNote = normalizeNoteDraft(note);
      const validationError = validateNoteDraft(normalizedNote);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      const linkedTopic = normalizedNote.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === normalizedNote.topicId)
        : undefined;
      if (normalizedNote.topicId && !linkedTopic) {
        notify(
          "This note’s topic is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      if (stateRef.current.notes.length >= WORKSPACE_NOTE_LIMIT) {
        notify(
          `You can save up to ${WORKSPACE_NOTE_LIMIT.toLocaleString()} notes. Remove one before adding another.`,
          "warning"
        );
        return false;
      }
      const timestamp = new Date().toISOString();
      update(prev =>
        addStudyNote(
          prev,
          createStudyNote(
            linkedTopic
              ? { ...normalizedNote, subject: linkedTopic.subject }
              : normalizedNote,
            uid(),
            timestamp
          )
        )
      );
      notify("Note saved to your workspace.", "success");
      return true;
    },
    [update, notify]
  );

  const updateNote = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<StudyNote, "title" | "subject" | "topicId" | "content" | "pinned">
      >
    ) => {
      const current = stateRef.current.notes.find(note => note.id === id);
      if (!current) {
        notify(
          "This note is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      const draft = normalizeNoteDraft({
        title: patch.title ?? current.title,
        subject: patch.subject ?? current.subject,
        topicId: "topicId" in patch ? patch.topicId : current.topicId,
        content: patch.content ?? current.content,
        pinned: patch.pinned ?? current.pinned,
      });
      const validationError = validateNoteDraft(draft);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      const linkedTopic = draft.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === draft.topicId)
        : undefined;
      if (draft.topicId && !linkedTopic) {
        notify(
          "This note’s topic is no longer available. Your details are still here.",
          "warning"
        );
        return false;
      }
      update(prev =>
        updateStudyNote(
          prev,
          id,
          linkedTopic ? { ...draft, subject: linkedTopic.subject } : draft,
          new Date().toISOString()
        )
      );
      return true;
    },
    [update, notify]
  );

  const deleteNote = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(removeStudyNote(prev, id), "notes", [id])
      );
      notify("Note removed from your workspace.");
    },
    [update, notify]
  );

  /* ── focus ──────────────────────────────────────────────────────── */

  /* ── habits ─────────────────────────────────────────────────────── */

  const addHabit = useCallback(
    (name: string, emoji: string) => {
      const normalizedName = name.trim();
      const normalizedEmoji = emoji.trim();
      if (
        !normalizedName ||
        normalizedName.length > 120 ||
        !normalizedEmoji ||
        normalizedEmoji.length > 32
      ) {
        notify(
          "Choose a habit name and icon within the workspace limits.",
          "warning"
        );
        return false;
      }
      if (stateRef.current.habits.length >= 100) {
        notify(
          "You can track up to 100 habits. Remove one before adding another.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        habits: [
          ...prev.habits,
          {
            id: uid(),
            name: normalizedName,
            emoji: normalizedEmoji,
            createdAt: todayStr(),
          },
        ],
      }));
      notify(
        `Habit “${normalizedName}” added — consistency is king!`,
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const deleteHabit = useCallback(
    (id: string) => {
      update(prev => {
        const log = { ...prev.habitLog };
        for (const d of Object.keys(log)) log[d] = log[d].filter(h => h !== id);
        return appendSyncTombstones(
          {
            ...prev,
            habits: prev.habits.filter(h => h.id !== id),
            habitLog: log,
          },
          "habits",
          [id]
        );
      });
      notify("Habit removed.");
    },
    [update, notify]
  );

  /* ── friends / leaderboard ──────────────────────────────────────── */

  const addFriend = useCallback(
    (name: string, emoji: string, weeklyBase: number) => {
      const normalizedName = name.trim();
      const normalizedEmoji = emoji.trim();
      if (
        !normalizedName ||
        normalizedName.length > 120 ||
        !normalizedEmoji ||
        normalizedEmoji.length > 32 ||
        !Number.isFinite(weeklyBase) ||
        weeklyBase < 0 ||
        weeklyBase > 1_000_000
      ) {
        notify(
          "Choose valid friend details within the workspace limits.",
          "warning"
        );
        return false;
      }
      if (stateRef.current.friends.length >= 100) {
        notify(
          "You can compare with up to 100 simulated friends. Remove one before adding another.",
          "warning"
        );
        return false;
      }
      update(prev => ({
        ...prev,
        friends: [
          ...prev.friends,
          {
            id: uid(),
            name: normalizedName,
            emoji: normalizedEmoji,
            weeklyBase,
          },
        ],
      }));
      notify(
        `Friend “${normalizedName}” joined the board — time to compete!`,
        "success"
      );
      return true;
    },
    [update, notify]
  );

  const deleteFriend = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, friends: prev.friends.filter(f => f.id !== id) },
          "friends",
          [id]
        )
      );
      notify("Friend removed from the board.");
    },
    [update, notify]
  );

  const toggleHabit = useCallback(
    (id: string, date = todayStr()) => {
      if (!stateRef.current.habits.some(habit => habit.id === id)) {
        notify("This habit is no longer available.", "warning");
        return false;
      }
      if (!isValidLocalIsoDate(date)) {
        notify("Choose a valid local calendar day.", "warning");
        return false;
      }
      update(prev => toggleHabitCompletion(prev, id, date));
      return true;
    },
    [update, notify]
  );

  /* ── focus ──────────────────────────────────────────────────────── */

  const addFocusSession = useCallback(
    (
      subject: string,
      duration: number,
      objective?: { taskId?: string; topicId?: string; objective?: string }
    ) => {
      const input = normalizeFocusSessionInput({
        subject,
        duration,
        date: todayStr(),
        objective: objective?.objective,
      });
      const validationError = validateFocusSessionInput(input);
      if (validationError) {
        notify(validationError, "warning");
        return false;
      }
      if (
        stateRef.current.focusSessions.length >= WORKSPACE_FOCUS_SESSION_LIMIT
      ) {
        notify(
          `You can record up to ${WORKSPACE_FOCUS_SESSION_LIMIT.toLocaleString()} Focus sessions. Remove old data before adding another.`,
          "warning"
        );
        return false;
      }
      const earnedXp = Math.round(input.duration / 10);
      const timestamp = new Date().toISOString();
      const focusId = uid();
      const currentTopic = objective?.topicId
        ? [
            ...stateRef.current.topics.map(topic => ({
              id: topic.id,
              subject: topic.subject,
            })),
            ...stateRef.current.exams.flatMap(exam =>
              exam.topics.map(topic => ({
                id: topic.id,
                subject: exam.subject,
              }))
            ),
          ].find(topic => topic.id === objective.topicId)
        : undefined;
      if (objective?.topicId && !currentTopic)
        notify(
          "The selected Focus topic was removed, so this session was saved without linked learning evidence.",
          "warning"
        );
      update(prev => {
        const task = objective?.taskId
          ? prev.tasks.find(
              candidate =>
                candidate.id === objective.taskId &&
                candidate.status !== "completed"
            )
          : undefined;
        const topicId = currentTopic?.id;
        const focusSessions = [
          ...prev.focusSessions,
          {
            id: focusId,
            subject: currentTopic?.subject ?? input.subject,
            duration: input.duration,
            date: input.date,
            ...(task ? { taskId: task.id } : {}),
            ...(topicId ? { topicId } : {}),
            ...(input.objective ? { objective: input.objective } : {}),
          },
        ];
        const tasks = task
          ? prev.tasks.map(candidate =>
              candidate.id === task.id
                ? applyTaskWork(candidate, input.duration, timestamp)
                : candidate
            )
          : prev.tasks;
        const learningEvidence = topicId
          ? [
              ...prev.learningEvidence,
              {
                id: uid(),
                topicId,
                subject: currentTopic.subject,
                kind: "study_session" as const,
                minutes: input.duration,
                sourceId: focusId,
                recordedAt: timestamp,
              },
            ].slice(-20_000)
          : prev.learningEvidence;
        return {
          ...prev,
          tasks,
          learningEvidence,
          focusSessions,
          goals: prev.goals.map(g =>
            g.category === "focus" && !g.completed && g.unit === "sessions"
              ? { ...g, current: Math.min(g.target, g.current + 1) }
              : g
          ),
        };
      });
      notify(`Focus session recorded (${input.duration} min).`, "success");
      logActivity();
      awardXp(earnedXp);
      return true;
    },
    [update, notify, logActivity, awardXp]
  );

  /* ── notifications/settings/data ────────────────────────────────── */

  const markAllRead = useCallback(() => {
    update(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
    }));
  }, [update]);

  const markNotificationRead = useCallback(
    (id: string) => {
      update(prev => ({
        ...prev,
        notifications: prev.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
      }));
    },
    [update]
  );

  const clearNotifications = useCallback(() => {
    update(prev =>
      appendSyncTombstones(
        { ...prev, notifications: [] },
        "notifications",
        prev.notifications.map(notification => notification.id)
      )
    );
  }, [update]);

  const setTheme = useCallback(
    (theme: "light" | "dark" | "system") => {
      if (!(["light", "dark", "system"] as const).includes(theme)) {
        notify("Choose light, dark, or system appearance.", "warning");
        return false;
      }
      update(prev => ({ ...prev, settings: { ...prev.settings, theme } }));
      return true;
    },
    [update, notify]
  );

  const setCurrency = useCallback(
    (currency: StudyState["settings"]["currency"]) => {
      if (
        !(
          ["GHS", "NGN", "KES", "ZAR", "USD", "GBP", "EUR", "INR"] as const
        ).includes(currency)
      ) {
        notify("Choose a supported currency.", "warning");
        return false;
      }
      update(prev => ({ ...prev, settings: { ...prev.settings, currency } }));
      return true;
    },
    [update, notify]
  );

  const setTimerPrefs = useCallback(
    (prefs: StudyState["settings"]["timerPrefs"]) => {
      if (
        !Number.isInteger(prefs.focus) ||
        prefs.focus < 1 ||
        prefs.focus > 240 ||
        !Number.isInteger(prefs.breakLen) ||
        prefs.breakLen < 1 ||
        prefs.breakLen > 120 ||
        !prefs.preset.trim() ||
        prefs.preset.length > 1_000
      ) {
        notify("Choose valid Focus and break timer preferences.", "warning");
        return false;
      }
      update(prev => ({
        ...prev,
        settings: { ...prev.settings, timerPrefs: prefs },
      }));
      notify("Timer settings saved.");
      return true;
    },
    [update, notify]
  );

  const exportStateFn = useCallback(() => exportData(stateRef.current), []);

  const importStateFn = useCallback(
    async (json: string) => {
      const parsed = parseImportData(json);
      if (!parsed.state) {
        const message =
          parsed.reason === "too_large"
            ? "This backup is too large to import safely. Your current workspace is unchanged."
            : parsed.reason === "invalid_json"
              ? "This backup file is not valid JSON. Your current workspace is unchanged."
              : "This backup does not match a valid Student OS workspace. Your current workspace is unchanged.";
        notify(message, "warning");
        return false;
      }
      const normalizedImported = preserveLegacyRewardMarkers(parsed.state);
      if (!saveState(normalizedImported, openId)) {
        notify(
          "Data could not be safely saved on this device. Your current workspace is unchanged.",
          "warning"
        );
        return false;
      }
      stateRef.current = normalizedImported;
      setState(normalizedImported);
      clearWorkspaceRecovery(openId);
      setRecoveryRequired(false);
      notify("Data imported successfully.", "success");
      return true;
    },
    [notify, openId]
  );

  const resolveWorkspaceConflict = useCallback(
    async (resolution: "cloud" | "local" | "merge") => {
      const conflict = loadWorkspaceConflict(openId);
      if (!conflict) {
        setSyncConflictAvailable(false);
        if (syncStatus === "conflict") setSyncStatus("synced");
        return true;
      }

      if (resolution === "cloud") {
        clearWorkspaceConflict(openId);
        setSyncConflictAvailable(false);
        setSyncStatus("synced");
        return true;
      }

      if (!navigator.onLine) {
        setSyncStatus("offline");
        return false;
      }

      try {
        const refreshed = await workspaceQuery.refetch();
        const remoteResult = validateStudyState(refreshed.data?.workspace);
        if (
          refreshed.isError ||
          (!remoteResult.success && refreshed.data?.workspace != null)
        ) {
          setSyncStatus("failed");
          return false;
        }

        const remoteState = preserveDevicePrivateWorkspaceFields(
          remoteResult.success
            ? (remoteResult.data as StudyState)
            : emptyState(),
          stateRef.current
        );
        const localResult = validateStudyState(
          JSON.parse(conflict.localWorkspace)
        );
        if (!localResult.success) {
          clearWorkspaceConflict(openId);
          setSyncConflictAvailable(false);
          setSyncStatus("failed");
          notify(
            "The saved local changes could not be recovered safely.",
            "warning"
          );
          return false;
        }
        const localState = preserveDevicePrivateWorkspaceFields(
          localResult.data as StudyState,
          stateRef.current
        );
        const nextState =
          resolution === "local"
            ? localState
            : mergeWorkspaceStates(remoteState, localState);
        const write = await saveWorkspace.mutateAsync({
          workspace: projectWorkspaceForCloud(nextState),
          revision: refreshed.data?.revision ?? conflict.remoteRevision,
        });

        if (!write.success) {
          if (
            write.reason === "conflict" &&
            write.workspace &&
            typeof write.revision === "number"
          ) {
            saveWorkspaceConflict(openId, {
              detectedAt: new Date().toISOString(),
              remoteRevision: write.revision,
              localWorkspace: JSON.stringify(nextState),
            });
            setSyncConflictAvailable(true);
            setSyncStatus("conflict");
            notify(
              "The workspace changed again. Your changes are still preserved.",
              "warning"
            );
            return false;
          }
          setSyncStatus("failed");
          return false;
        }

        stateRef.current = nextState;
        revisionRef.current = write.revision;
        saveState(nextState, openId);
        setState(nextState);
        saveWorkspaceMeta(openId, {
          revision: write.revision,
          pending: false,
          updatedAt: new Date().toISOString(),
        });
        clearWorkspaceConflict(openId);
        setSyncConflictAvailable(false);
        setSyncStatus("synced");
        notify(
          resolution === "merge"
            ? "Cloud and device changes were safely combined."
            : "Your saved device changes are now synced.",
          "success"
        );
        return true;
      } catch {
        setSyncStatus(navigator.onLine ? "failed" : "offline");
        return false;
      }
    },
    [openId, notify, saveWorkspace, syncStatus, workspaceQuery]
  );

  const resetStateFn = useCallback(async () => {
    // Validate the protected cloud replacement before removing any local bytes.
    // A failed fetch or malformed cloud payload must leave the current device cache intact.
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return false;
    }
    try {
      const refreshed = await workspaceQuery.refetch();
      if (refreshed.isError) {
        setSyncStatus("failed");
        return false;
      }
      const remoteResult = validateStudyState(refreshed.data?.workspace);
      if (!remoteResult.success && refreshed.data?.workspace != null) {
        setSyncStatus("failed");
        return false;
      }
      const adopted = preserveDevicePrivateWorkspaceFields(
        remoteResult.success ? (remoteResult.data as StudyState) : emptyState(),
        stateRef.current
      );
      if (!clearState(openId) || !saveState(adopted, openId)) {
        setSyncStatus("storage_error");
        return false;
      }
      stateRef.current = adopted;
      setState(adopted);
      revisionRef.current = refreshed.data?.revision ?? 0;
      saveWorkspaceMeta(openId, {
        revision: revisionRef.current,
        pending: false,
        updatedAt: new Date().toISOString(),
      });
      clearWorkspaceRecovery(openId);
      setRecoveryRequired(false);
      setSyncStatus("synced");
      return true;
    } catch {
      setSyncStatus("failed");
      return false;
    }
  }, [openId, workspaceQuery]);

  const deleteWorkspaceEverywhere = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return false;
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    // A prior save may resolve after deliberate deletion. Its response must not
    // merge old state back into memory or local persistence.
    syncGenerationRef.current += 1;
    try {
      const result = await clearWorkspace.mutateAsync();
      const cleared = emptyState();
      revisionRef.current = result.revision;
      stateRef.current = cleared;
      lessonCompletionClaimRef.current = new Set();
      clearState(openId);
      saveState(cleared, openId);
      saveWorkspaceMeta(openId, {
        revision: result.revision,
        pending: false,
        updatedAt: result.updatedAt.toISOString(),
      });
      skipNextSyncRef.current = true;
      setState(cleared);
      setSyncStatus("synced");
      return true;
    } catch {
      setSyncStatus(navigator.onLine ? "failed" : "offline");
      return false;
    }
  }, [clearWorkspace, openId]);

  const restartOnboarding = useCallback(async () => {
    const restarted = restartOnboardingState(stateRef.current);
    stateRef.current = restarted;
    saveState(restarted, openId);
    setState(restarted);
    return true;
  }, [openId]);

  const completeDailyLesson = useCallback(
    (lessonKey: string, lessonTitle: string) => {
      if (
        stateRef.current.dailyLessonCompletions.includes(lessonKey) ||
        lessonCompletionClaimRef.current.has(lessonKey)
      )
        return;
      lessonCompletionClaimRef.current.add(lessonKey);
      update(prev => {
        const result = recordDailyLessonCompletion(
          prev,
          lessonKey,
          XP_RULES.dailyLesson
        );
        return result.state;
      });
      notify(
        `Daily Lesson complete: ${lessonTitle}. +${XP_RULES.dailyLesson} XP`,
        "success"
      );
      logActivity();
    },
    [update, notify, logActivity]
  );

  /* ── saved lessons (bookmarks) ─────────────────────────────────────
     Students can bookmark any Daily Lesson for later review. A lesson is
     keyed by its selection key so saving the same day twice is a no-op. */
  const saveSavedLesson = useCallback(
    (lesson: Omit<SavedLesson, "id" | "savedAt">) => {
      if (
        stateRef.current.savedLessons.some(
          s => s.selectionKey === lesson.selectionKey
        ) ||
        savedLessonClaimRef.current.has(lesson.selectionKey)
      )
        return;
      savedLessonClaimRef.current.add(lesson.selectionKey);
      update(prev => ({
        ...prev,
        savedLessons: [
          { id: uid(), ...lesson, savedAt: new Date().toISOString() },
          ...prev.savedLessons,
        ],
      }));
      notify(`Lesson saved to your library: ${lesson.title}.`, "success");
    },
    [update, notify]
  );

  const removeSavedLesson = useCallback(
    (id: string) => {
      update(prev =>
        appendSyncTombstones(
          { ...prev, savedLessons: prev.savedLessons.filter(s => s.id !== id) },
          "savedLessons",
          [id]
        )
      );
      notify("Lesson removed from your library.");
    },
    [update, notify]
  );

  const value: StoreValue = {
    state,
    accountCacheScope: openId,
    workspaceReady,
    syncStatus,
    recoveryRequired,
    syncConflictAvailable,
    resolveWorkspaceConflict,
    markOnboarded,
    setProfile,
    setAcademicJourney,
    setTransitionDecisionHub,
    confirmAcademicGraduation,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    recordTaskWork,
    deferTask,
    addSession,
    updateSession,
    deleteSession,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    skipSession,
    rescheduleSession,
    createStudyPlan,
    setStudyPlanItemStatus,
    startStudyPlanItem,
    rebalanceStudyPlan,
    createQuiz,
    recordQuizAttempt,
    addStudyMaterial,
    deleteStudyMaterial,
    markStudyMaterialAiConsent,
    markStudyMaterialAiPracticeQuestionConsent,
    saveMaterialFlashcardDraft,
    addDeck,
    updateDeck,
    deleteDeck,
    addCard,
    updateCard,
    deleteCard,
    addExam,
    updateExam,
    deleteExam,
    addExamTopic,
    deleteExamTopic,
    setTopicStatus,
    addEvent,
    updateEvent,
    deleteEvent,
    addTransaction,
    deleteTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    bumpGoal,
    completeGoal,
    addNote,
    updateNote,
    deleteNote,
    addFocusSession,
    addHabit,
    deleteHabit,
    toggleHabit,
    addFriend,
    deleteFriend,
    notify,
    markNotificationRead,
    markAllRead,
    clearNotifications,
    setTheme,
    setCurrency,
    setTimerPrefs,
    setNotificationsEnabled,
    setNotificationPreferences,
    setDailyGoalTarget,
    addCustomReminder,
    updateCustomReminder,
    deleteCustomReminder,
    rateAiAnswer,
    updateAiAnswerReason,
    clearAiAnswerRatings,
    exportState: exportStateFn,
    importState: importStateFn,
    resetState: resetStateFn,
    deleteWorkspaceEverywhere,
    restartOnboarding,
    completeDailyLesson,
    saveSavedLesson,
    removeSavedLesson,
    logActivity,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
