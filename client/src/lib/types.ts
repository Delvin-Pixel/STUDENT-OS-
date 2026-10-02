/* STUDENT OS — shared data models. Everything is stored locally; the shape is
   kept stable so auth + cloud sync can be layered on later. */

export type StudentType =
  "Secondary School" | "University" | "College" | "Other";

/** The curriculum band used to tailor Daily Lessons. */
export type EducationLevel =
  | "Primary"
  | "Lower Secondary"
  | "Secondary"
  | "Sixth Form / College"
  | "Tertiary"
  | "Other";

export type AcademicStage = "Primary" | "JHS" | "SHS" | "Tertiary" | "Other";
export type JourneyStatus =
  | "current"
  | "approaching_graduation"
  | "awaiting_confirmation"
  | "transitioning"
  | "completed";

export type FoundationCheckStatus = "not_started" | "due" | "completed";
export type FoundationAttentionStatus =
  "none" | "needs_remediation" | "ready_to_recheck";

/** Periodic checks of prior-level knowledge that supports the learner's current stage. */
export interface FoundationCheck {
  id: string;
  subject: string;
  sourceStage: AcademicStage;
  sourceClassLevel: string;
  currentStage: AcademicStage;
  currentClassLevel: string;
  status: FoundationCheckStatus;
  createdAt: string;
  nextDueAt: string;
  lastAssessedAt?: string;
  lastScore?: number;
  attemptCount: number;
  rationale: string;
  /** Topic IDs selected as diagnostic targets when known; empty means subject-level fallback. */
  focusTopicIds?: string[];
  /** Human-readable concepts selected for the diagnostic. */
  focusConcepts?: string[];
  attentionStatus?: FoundationAttentionStatus;
  weakConcepts?: string[];
  remediationTopicIds?: string[];
  remediationAttemptCount?: number;
  lastOutcomeSummary?: string;
  lastRemediationAt?: string;
}

export interface AcademicJourneyRecord {
  stage: AcademicStage;
  classLevel?: string;
  academicYear: string;
  expectedCompletionYear?: number;
  expectedNextStage?: AcademicStage;
  status: JourneyStatus;
  detectedAt: string;
  graduationConfirmedAt?: string;
  completedAt?: string;
}

export interface AcademicJourney {
  current: AcademicJourneyRecord;
  history: AcademicJourneyRecord[];
  transition?: {
    from: AcademicStage;
    to: AcademicStage;
    status: "preparing" | "awaiting_confirmation" | "confirmed";
    startedAt: string;
    confirmedAt?: string;
  };
}

export interface Profile {
  name: string;
  /** Opaque account-owned key resolved through a protected signed-URL route. */
  profilePhotoStorageKey?: string;
  /** Legacy raw path retained only for one-way migration to the protected route. */
  profilePhotoUrl?: string;
  age?: number;
  studentType: StudentType;
  educationLevel: EducationLevel;
  /** Current class/year inside the selected education level, e.g. JHS 3, SHS 2, Level 200. */
  classLevel?: string;
  /** Academic year supplied at onboarding; used for journey timing and progression. */
  academicYear?: string;
  /** Optional programme/track context, e.g. General Science or Business. */
  academicTrack?: string;
  /** Distinguishes school subjects from tertiary degree/course selections. Legacy profiles infer this from education level. */
  academicSelectionKind?: "subject" | "course";
  /** Optional learner-selected location/system identity; legacy profiles remain valid when absent. */
  countryCode?: string;
  educationSystem?: string;
  goals: string[]; // onboarding goal selections
  subjects: string[];
  /** Optional, versioned metadata for an explicitly selected verified catalogue. */
  curriculumContext?: import("./curriculumCatalogue").CurriculumContext;
  /** Existing/custom labels are never implicitly promoted to catalogue subjects. */
  subjectProvenance?: Record<
    string,
    import("./curriculumCatalogue").CurriculumSubjectProvenance
  >;
  hoursPerDay: string; // e.g. "1 hour"
}

export type Priority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "completed";

/** Learner-defined task steps remain part of one task record so offline merge and deletion stay atomic. */
export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

/** A canonical deletion marker retained so an offline peer cannot resurrect a removed record during merge. */
export type SyncTombstoneCollection =
  | "tasks"
  | "sessions"
  | "topics"
  | "learningEvidence"
  | "studyPlans"
  | "studyPlanItems"
  | "quizzes"
  | "quizAttempts"
  | "studyMaterials"
  | "decks"
  | "cards"
  | "exams"
  | "examTopics"
  | "events"
  | "transactions"
  | "goals"
  | "focusSessions"
  | "notes"
  | "achievements"
  | "notifications"
  | "customReminders"
  | "aiAnswerRatings"
  | "habits"
  | "friends"
  | "savedLessons";

export interface SyncTombstone {
  collection: SyncTombstoneCollection;
  id: string;
  deletedAt: string;
}

export type TaskOrigin = "manual" | "transition" | "system";

export interface Task {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string; // ISO date or ""
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  /** Retained after reopening so a task completion reward cannot be replayed. */
  xpAwardedAt?: string;
  /** Optional canonical topic link; a task can still remain general or subject-only. */
  topicId?: string;
  /** Learner estimate used for capacity and recovery guidance, not time tracking by itself. */
  estimatedMinutes?: number;
  /** Confirmed time spent through a linked Focus round or explicit progress update. */
  actualMinutes?: number;
  /** Explicit learner progress; subtask completion can raise this estimate but never certifies learning. */
  progressPercent?: number;
  subtasks?: TaskSubtask[];
  /** Task IDs that must be completed before this task is ready to finish. */
  dependsOnTaskIds?: string[];
  /** A deliberate recovery pause; deferred work is not falsely presented as immediately actionable. */
  deferredUntil?: string;
  recoveryReason?: string;
  lastWorkedAt?: string;
  /** Optional provenance for connected system-generated work; never used to bypass task lifecycle checks. */
  origin?: TaskOrigin;
  /** Stable source reference used to deduplicate promoted work (for example transition:prep-id). */
  sourceRef?: string;
}

export type SessionStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "completed"
  | "skipped"
  | "rescheduled";
export type Difficulty = "easy" | "medium" | "hard";
export type SessionSkipReason =
  | "too_tired"
  | "no_time"
  | "higher_priority"
  | "missing_materials"
  | "not_ready"
  | "other";
export type SessionReflection =
  "easy" | "okay" | "difficult" | "still_confused";

export interface StudySession {
  id: string;
  subject: string;
  topic: string;
  topicId?: string;
  planId?: string;
  planItemId?: string;
  date: string; // ISO date
  startTime: string; // "HH:mm"
  duration: number; // minutes
  difficulty: Difficulty;
  priority: Priority;
  notes: string;
  status: SessionStatus;
  /** Execution timestamps are optional so legacy planned sessions remain valid. */
  startedAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  finishedAt?: string;
  /** Learner-confirmed minutes; only completion uses this for goals and evidence. */
  actualDuration?: number;
  skipReason?: SessionSkipReason;
  rescheduleReason?: string;
  reflection?: SessionReflection;
}

/** A canonical topic that can connect an exam, session, note, deck, quiz, and recommendation. */
export interface SubjectTopic {
  id: string;
  subject: string;
  name: string;
  source: "manual" | "exam" | "session" | "note" | "flashcard" | "quiz";
  createdAt: string;
  updatedAt: string;
  /** Canonical prerequisite topics that should be understood before this topic. */
  prerequisiteTopicIds?: string[];
  /** Optional learning objective used to make recovery explanations precise. */
  learningObjective?: string;
  /** Optional academic level tag used by Foundation Monitor to target the correct historical layer. */
  academicClassLevel?: string;
}

/** A bounded, explainable signal used to estimate learning strength. */
export interface LearningEvidence {
  id: string;
  topicId: string;
  subject: string;
  kind: "quiz" | "flashcard" | "practice" | "study_session";
  /** Percentage result when a direct assessment was completed. */
  score?: number;
  /** Minutes receive modest capped credit and never become a mastery proxy alone. */
  minutes?: number;
  sourceId?: string;
  recordedAt: string;
}

export type StudyPlanItemStatus = "planned" | "completed" | "skipped";

/** A learner-editable study-plan item linked to the existing scheduling model. */
export interface StudyPlanItem {
  id: string;
  subject: string;
  topic: string;
  topicId?: string;
  date: string;
  startTime: string;
  duration: number;
  priority: Priority;
  reason: string;
  status: StudyPlanItemStatus;
  linkedExamId?: string;
  createdAt: string;
  skipReason?: SessionSkipReason;
  rescheduledAt?: string;
}

/** A persistent plan can be recalculated without destroying completed work. */
export interface StudyPlan {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  availableMinutesPerDay: number;
  createdAt: string;
  updatedAt: string;
  items: StudyPlanItem[];
}

export type QuizQuestionType = "multiple_choice" | "true_false";

/** Learner-authored or AI-drafted questions remain editable before a quiz is taken. */
export interface QuizQuestion {
  id: string;
  prompt: string;
  type: QuizQuestionType;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  subtopic?: string;
}

export interface StudyQuiz {
  id: string;
  title: string;
  subject: string;
  topic: string;
  topicId?: string;
  source: "manual" | "ai_draft";
  assessmentKind?: "standard" | "foundation" | "foundation_remediation";
  foundationSourceStage?: AcademicStage;
  foundationSourceClassLevel?: string;
  currentAcademicClassLevel?: string;
  createdAt: string;
  questions: QuizQuestion[];
}

/** The compact result is retained separately from answers to preserve a clear mastery signal. */
export interface QuizAttempt {
  id: string;
  quizId: string;
  subject: string;
  topicId?: string;
  score: number;
  correctCount: number;
  questionCount: number;
  completedAt: string;
  /** Optional response review retained for learner remediation; score remains the mastery signal. */
  responses?: QuizAttemptResponse[];
}

export interface QuizAttemptResponse {
  questionId: string;
  prompt: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  correct: boolean;
  explanation: string;
  /** Optional concept tag retained so assessment intelligence can localize repeated misses. */
  subtopic?: string;
}

/** Account-owned reference to a study file. Uploading never authorizes AI processing by itself. */
export interface StudyMaterial {
  id: string;
  title: string;
  subject: string;
  topicId?: string;
  fileName: string;
  mimeType: "application/pdf" | "text/plain";
  storageKey: string;
  url: string;
  sizeBytes: number;
  addedAt: string;
  /** Recorded only after the learner explicitly requests an AI action for this material. */
  aiProcessingConsentAt?: string;
  /** Recorded only after the learner explicitly requests a material-derived AI practice-question draft. */
  aiPracticeQuestionConsentAt?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  status: "new" | "easy" | "difficult"; // difficult gets resurfaced
  /** Local calendar date when this card should next reappear. */
  dueDate?: string;
  intervalDays?: number;
  reviewCount?: number;
  lastReviewedAt?: string;
  nextReviewDate?: string;
  /** A learner-facing estimate derived from actual review outcomes, not a guarantee. */
  retentionEstimate?: number;
  easeFactor?: number;
  lapses?: number;
}

export interface Deck {
  id: string;
  name: string;
  subject: string;
  topicId?: string;
  cards: Flashcard[];
  createdAt: string;
}

export type TopicStatus = "not_started" | "learning" | "revised" | "mastered";

export interface ExamTopic {
  id: string;
  name: string;
  status: TopicStatus;
}

export interface Exam {
  id: string;
  subject: string;
  name: string;
  date: string; // ISO date
  time: string; // "HH:mm" or ""
  location: string;
  notes: string;
  topics: ExamTopic[];
}

export interface TimetableEvent {
  id: string;
  title: string;
  subject: string;
  day: number; // 0 = Monday ... 6 = Sunday
  startTime: string; // "HH:mm"
  endTime: string;
  type: "class" | "study" | "exam" | "personal";
  location: string;
  notes: string;
}

export type BudgetCategory =
  "food" | "transport" | "school" | "entertainment" | "other";

export type CurrencyCode =
  "GHS" | "NGN" | "KES" | "ZAR" | "USD" | "GBP" | "EUR" | "INR";

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: BudgetCategory;
  label: string;
  date: string; // ISO date
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string; // ISO date or ""
  category: "study" | "tasks" | "flashcards" | "focus" | "custom";
  completed: boolean;
  /** Retained after reopening so a goal reward cannot be replayed. */
  xpAwarded?: boolean;
  /** Timestamp for the one-time goal reward; legacy goals without it are not projected into a dated weekly total. */
  xpAwardedAt?: string;
  unit: string; // e.g. "hours", "chapters", "cards"
}

export interface FocusSessionRecord {
  id: string;
  subject: string;
  duration: number; // minutes
  date: string; // ISO date
  taskId?: string;
  topicId?: string;
  /** Learner-selected work objective for an otherwise general focus round. */
  objective?: string;
}

/** A lightweight, offline-first learning note. */
export interface StudyNote {
  id: string;
  title: string;
  subject: string;
  topicId?: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface NotificationItem {
  id: string;
  text: string;
  type: "info" | "success" | "warning";
  read: boolean;
  createdAt: string;
}

export interface TimerPrefs {
  focus: number;
  breakLen: number;
  preset: string;
}

/** Account-synced controls for learning reminders. Device permission remains local to each phone. */
export interface NotificationPreferences {
  tasks: boolean;
  exams: boolean;
  focus: boolean;
  studyPlan: boolean;
  dailyGoal: boolean;
  streak: boolean;
  savedLessons: boolean;
  /** Default vibration is honored by supported installed browsers; sound remains device-managed. */
  vibrationPattern: "off" | "gentle" | "standard" | "strong";
  /** Category choices override the default pattern when the matching reminder is delivered. */
  categoryVibrationPatterns: Partial<
    Record<
      | "tasks"
      | "exams"
      | "focus"
      | "studyPlan"
      | "dailyGoal"
      | "streak"
      | "savedLessons"
      | "custom",
      "off" | "gentle" | "standard" | "strong"
    >
  >;
  quietHours: { enabled: boolean; start: string; end: string };
  /** A respectful limit on planned alerts per local calendar day (1–6). */
  dailyCap: number;
  /** Local time for the next-study-plan nudge. */
  studyPlanTime: string;
  /** Local time for a daily progress check-in. */
  dailyGoalTime: string;
}

/** A focused daily target, counted from completed study sessions and focus blocks. */
export interface DailyLearningGoal {
  targetMinutes: number;
}

/** A learner-authored phone reminder. Time values use the device's local timezone. */
export interface CustomReminder {
  id: string;
  title: string;
  message: string;
  /** A one-time reminder uses this local ISO date; daily reminders leave it blank. */
  date: string;
  time: string;
  repeat: "once" | "daily";
  enabled: boolean;
  createdAt: string;
}

export type AiAnswerFeedbackReason =
  | "too_vague"
  | "missed_question"
  | "too_complex"
  | "may_be_inaccurate"
  | "needs_example";

/** Private learner feedback on an AI answer, retained only in the device-local workspace. */
export interface AiAnswerRating {
  answerId: string;
  surface: "lesson" | "assistant";
  rating: "up" | "down";
  /** Private local excerpt of the answer, retained only so the learner can review it. */
  answerPreview: string;
  /** Optional learner-selected reason for an unhelpful answer. */
  reason?: AiAnswerFeedbackReason;
  ratedAt: string;
}

export interface Friend {
  id: string;
  name: string;
  emoji: string;
  /** base weekly XP target — actual weekly score is seeded around this */
  weeklyBase: number;
}

export interface GradeResult {
  id: string;
  subject: string;
  grade: string;
  category: "core" | "elective" | "other";
  year?: string;
}

export interface TransitionRequiredSubject {
  subject: string;
  minimumGrade?: string;
}

export interface TransitionDecisionOption {
  id: string;
  name: string;
  provider?: string;
  type: "school" | "programme" | "university" | "course";
  sourceUrl?: string;
  sourceLabel?: string;
  sourceVerifiedAt?: string;
  confidence:
    "official" | "verified_secondary" | "learner_entered" | "unverified";
  requiredSubjects: TransitionRequiredSubject[];
  maxAggregate?: number;
  eligibility?: "not_assessed" | "meets_stated_requirements" | "needs_review";
  eligibilityReasons?: string[];
  notes?: string;
}

export interface TransitionPreparationTask {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
}

export interface TransitionDecisionHub {
  sourceStage: AcademicStage;
  targetStage?: AcademicStage;
  status: "preparing" | "results_captured" | "decision_ready";
  qualification?: string;
  results: GradeResult[];
  aggregate?: number;
  aggregateTrack?: "science" | "non_science" | "best_six";
  aggregateMethod?: string;
  aggregateConfidence?:
    "official" | "verified_secondary" | "calculated_local" | "unverified";
  options: TransitionDecisionOption[];
  preparationTasks: TransitionPreparationTask[];
  lastUpdatedAt: string;
}

export interface StudyState {
  profile: Profile | null;
  /** Longitudinal academic journey state; older workspaces may omit this until hydration. */
  academicJourney?: AcademicJourney;
  /** Results, aggregate reasoning, and next-stage decision support remain separate from the active academic identity. */
  transitionDecisionHub?: TransitionDecisionHub;
  /** Periodic prior-level foundation checks; derived from current academic progression. */
  foundationChecks: FoundationCheck[];
  onboarded: boolean;
  tasks: Task[];
  sessions: StudySession[];
  topics: SubjectTopic[];
  learningEvidence: LearningEvidence[];
  studyPlans: StudyPlan[];
  quizzes: StudyQuiz[];
  quizAttempts: QuizAttempt[];
  studyMaterials: StudyMaterial[];
  decks: Deck[];
  exams: Exam[];
  events: TimetableEvent[];
  transactions: Transaction[];
  goals: Goal[];
  focusSessions: FocusSessionRecord[];
  notes: StudyNote[];
  achievements: Achievement[];
  notifications: NotificationItem[];
  xp: number;
  lastActiveDay: string; // ISO date of last meaningful activity
  streakDays: number;
  streakStart: string; // first day of current streak
  /** Highest consecutive-day streak earned by this student. */
  longestStreak: number;
  /** Daily learning target, scoped to the student's private workspace. */
  dailyGoal: DailyLearningGoal;
  /** Learner-created reminders, scoped to this device-local workspace. */
  customReminders: CustomReminder[];
  /** Private, bounded feedback records and answer previews stored only in this device-local workspace. */
  aiAnswerRatings: AiAnswerRating[];
  settings: {
    theme: "light" | "dark" | "system";
    currency: CurrencyCode;
    timerPrefs: TimerPrefs;
    notifications: boolean; // browser notification reminders enabled
    notificationPreferences: NotificationPreferences;
  };
  habits: Habit[];
  /** date string -> habit ids completed that day */
  habitLog: Record<string, string[]>;
  friends: Friend[];
  /** Deterministic Daily Lesson keys completed by this student. */
  dailyLessonCompletions: string[];
  /** Daily Lessons the student bookmarked for later review. */
  savedLessons: SavedLesson[];
  /** Deletion markers are synchronized with the workspace so omitted records cannot be mistaken for stale data. */
  syncTombstones: SyncTombstone[];
}

/** A Daily Lesson the student bookmarked for later review. */
export interface SavedLesson {
  id: string;
  /** Deterministic selection key of the day it was saved, e.g. "2026-08-15:math". */
  selectionKey: string;
  /** ISO date of the lesson day (used to render "saved on Aug 15"). */
  dateStr: string;
  subject: string;
  branch: string;
  topic: string;
  title: string;
  strapline: string;
  /** Learning goals so review keeps its intent. */
  learningGoals: string[];
  /** Concise recap of the lesson body for review. */
  recap: string;
  savedAt: string;
}

export type TransitionFitBand =
  | "stronger_fit"
  | "possible_fit"
  | "borderline_fit"
  | "requirements_gap"
  | "insufficient_evidence";

export interface TransitionRecommendation {
  optionId: string;
  fitBand: TransitionFitBand;
  score: number;
  reasons: string[];
  caution: string;
}
