import { z } from "zod";

export const WORKSPACE_SCHEMA_VERSION = 4;
export const WORKSPACE_EXAM_LIMIT = 500;
export const WORKSPACE_EXAM_TOPIC_LIMIT = 500;
export const WORKSPACE_STUDY_MATERIAL_LIMIT = 500;
export const WORKSPACE_STUDY_SESSION_LIMIT = 5_000;
export const WORKSPACE_STUDY_PLAN_ITEM_LIMIT = 2_000;
export const WORKSPACE_DECK_LIMIT = 500;
export const WORKSPACE_FOCUS_SESSION_LIMIT = 5_000;
export const WORKSPACE_NOTE_LIMIT = 2_000;
export const WORKSPACE_TIMETABLE_EVENT_LIMIT = 1_000;

const id = z.string().min(1).max(160);
const localDate = z.string().max(32);
const localTime = z.string().max(16);
const text = z.string().max(20_000);
const shortText = z.string().max(1_000);
const priority = z.enum(["high", "medium", "low"]);
const syncTombstoneCollection = z.enum([
  "tasks",
  "sessions",
  "topics",
  "learningEvidence",
  "studyPlans",
  "studyPlanItems",
  "quizzes",
  "quizAttempts",
  "studyMaterials",
  "decks",
  "cards",
  "exams",
  "examTopics",
  "events",
  "transactions",
  "goals",
  "focusSessions",
  "notes",
  "achievements",
  "notifications",
  "customReminders",
  "aiAnswerRatings",
  "habits",
  "friends",
  "savedLessons",
]);

const profile = z.object({
  name: z.string().min(1).max(120),
  profilePhotoStorageKey: z.string().min(1).max(1_024).optional(),
  profilePhotoUrl: z.string().max(2_048).optional(),
  age: z.number().int().min(3).max(120).optional(),
  studentType: z.enum(["Secondary School", "University", "College", "Other"]),
  educationLevel: z.enum([
    "Primary",
    "Lower Secondary",
    "Secondary",
    "Sixth Form / College",
    "Tertiary",
    "Other",
  ]),
  classLevel: z.string().max(80).optional(),
  academicYear: z.string().max(80).optional(),
  academicSelectionKind: z.enum(["subject", "course"]).optional(),
  goals: z.array(shortText).max(20),
  subjects: z.array(shortText).max(30),
  curriculumContext: z
    .object({
      countryCode: z.string().min(2).max(8),
      educationSystem: z.string().min(1).max(160),
      catalogueId: z.string().min(1).max(160),
      catalogueVersion: z.string().min(1).max(64),
      sourceUrl: z.string().url().max(2_048),
    })
    .optional(),
  subjectProvenance: z
    .record(
      z.string().min(1).max(1_000),
      z
        .object({
          kind: z.enum(["catalogue", "custom", "unclassified"]),
          catalogueSubjectId: z.string().min(1).max(160).optional(),
        })
        .strict()
    )
    .optional(),
  hoursPerDay: z.string().max(80),
});

const notificationPreferences = z.object({
  tasks: z.boolean(),
  exams: z.boolean(),
  focus: z.boolean(),
  studyPlan: z.boolean(),
  dailyGoal: z.boolean(),
  streak: z.boolean(),
  savedLessons: z.boolean(),
  vibrationPattern: z.enum(["off", "gentle", "standard", "strong"]),
  categoryVibrationPatterns: z
    .object({
      tasks: z.enum(["off", "gentle", "standard", "strong"]),
      exams: z.enum(["off", "gentle", "standard", "strong"]),
      focus: z.enum(["off", "gentle", "standard", "strong"]),
      studyPlan: z.enum(["off", "gentle", "standard", "strong"]),
      dailyGoal: z.enum(["off", "gentle", "standard", "strong"]),
      streak: z.enum(["off", "gentle", "standard", "strong"]),
      savedLessons: z.enum(["off", "gentle", "standard", "strong"]),
      custom: z.enum(["off", "gentle", "standard", "strong"]),
    })
    .partial()
    .strict(),
  quietHours: z.object({
    enabled: z.boolean(),
    start: localTime,
    end: localTime,
  }),
  dailyCap: z.number().int().min(1).max(6),
  studyPlanTime: localTime,
  dailyGoalTime: localTime,
});

const academicJourneyRecord = z.object({
  stage: z.enum(["Primary", "JHS", "SHS", "Tertiary", "Other"]),
  classLevel: z.string().max(80).optional(),
  academicYear: z.string().max(80),
  expectedCompletionYear: z.number().int().min(2000).max(2200).optional(),
  expectedNextStage: z
    .enum(["Primary", "JHS", "SHS", "Tertiary", "Other"])
    .optional(),
  status: z.enum([
    "current",
    "approaching_graduation",
    "awaiting_confirmation",
    "transitioning",
    "completed",
  ]),
  detectedAt: z.string().max(64),
  graduationConfirmedAt: z.string().max(64).optional(),
  completedAt: z.string().max(64).optional(),
});

const academicJourney = z.object({
  current: academicJourneyRecord,
  history: z.array(academicJourneyRecord).max(20),
  transition: z
    .object({
      from: z.enum(["Primary", "JHS", "SHS", "Tertiary", "Other"]),
      to: z.enum(["Primary", "JHS", "SHS", "Tertiary", "Other"]),
      status: z.enum(["preparing", "awaiting_confirmation", "confirmed"]),
      startedAt: z.string().max(64),
      confirmedAt: z.string().max(64).optional(),
    })
    .optional(),
});

const gradeResult = z.object({
  id,
  subject: shortText,
  grade: shortText,
  category: z.enum(["core", "elective", "other"]),
  year: shortText.optional(),
});

const transitionDecisionOption = z.object({
  id,
  name: shortText,
  provider: shortText.optional(),
  type: z.enum(["school", "programme", "university", "course"]),
  sourceUrl: z
    .string()
    .url()
    .refine(url => new URL(url).protocol === "https:")
    .optional(),
  sourceLabel: shortText.optional(),
  sourceVerifiedAt: z.string().max(64).optional(),
  confidence: z.enum([
    "official",
    "verified_secondary",
    "learner_entered",
    "unverified",
  ]),
  requiredSubjects: z
    .array(z.object({ subject: shortText, minimumGrade: shortText.optional() }))
    .max(20),
  maxAggregate: z.number().int().min(1).max(100).optional(),
  eligibility: z
    .enum(["not_assessed", "meets_stated_requirements", "needs_review"])
    .optional(),
  eligibilityReasons: z.array(shortText).max(10).optional(),
  notes: text.optional(),
});

const transitionDecisionHub = z.object({
  sourceStage: z.enum(["Primary", "JHS", "SHS", "Tertiary", "Other"]),
  targetStage: z
    .enum(["Primary", "JHS", "SHS", "Tertiary", "Other"])
    .optional(),
  status: z.enum(["preparing", "results_captured", "decision_ready"]),
  qualification: shortText.optional(),
  results: z.array(gradeResult).max(30),
  aggregate: z.number().int().min(1).max(100).optional(),
  aggregateTrack: z.enum(["science", "non_science", "best_six"]).optional(),
  aggregateMethod: shortText.optional(),
  aggregateConfidence: z
    .enum(["official", "verified_secondary", "calculated_local", "unverified"])
    .optional(),
  options: z.array(transitionDecisionOption).max(100),
  preparationTasks: z
    .array(
      z.object({
        id,
        title: shortText,
        done: z.boolean(),
        dueDate: localDate.optional(),
      })
    )
    .max(30),
  lastUpdatedAt: z.string().max(64),
});

export const studyStateSchema = z
  .object({
    profile: profile.nullable(),
    academicJourney: academicJourney.optional(),
    transitionDecisionHub: transitionDecisionHub.optional(),
    foundationChecks: z
      .array(
        z.object({
          id,
          subject: shortText,
          focusTopicIds: z.array(id).max(20).optional(),
          focusConcepts: z.array(shortText).max(20).optional(),
          sourceStage: z.enum(["Primary", "JHS", "SHS", "Tertiary", "Other"]),
          sourceClassLevel: shortText,
          currentStage: z.enum(["Primary", "JHS", "SHS", "Tertiary", "Other"]),
          currentClassLevel: shortText,
          status: z.enum(["not_started", "due", "completed"]),
          createdAt: z.string().max(64),
          nextDueAt: z.string().max(64),
          lastAssessedAt: z.string().max(64).optional(),
          lastScore: z.number().finite().min(0).max(100).optional(),
          attemptCount: z.number().int().min(0).max(1000),
          rationale: shortText,
          attentionStatus: z
            .enum(["none", "needs_remediation", "ready_to_recheck"])
            .optional(),
          weakConcepts: z.array(shortText).max(20).optional(),
          remediationTopicIds: z.array(id).max(20).optional(),
          remediationAttemptCount: z.number().int().min(0).max(1000).optional(),
          lastOutcomeSummary: shortText.optional(),
          lastRemediationAt: z.string().max(64).optional(),
        })
      )
      .max(500)
      .default([]),
    onboarded: z.boolean(),
    tasks: z
      .array(
        z.object({
          id,
          title: shortText,
          description: text,
          subject: shortText,
          dueDate: localDate,
          priority,
          status: z.enum(["todo", "in_progress", "completed"]),
          createdAt: z.string().max(64),
          completedAt: z.string().max(64).optional(),
          xpAwardedAt: z.string().max(64).optional(),
          topicId: id.optional(),
          estimatedMinutes: z.number().int().min(1).max(1_440).optional(),
          actualMinutes: z.number().int().min(0).max(100_000).optional(),
          progressPercent: z.number().int().min(0).max(100).optional(),
          subtasks: z
            .array(z.object({ id, title: shortText, completed: z.boolean() }))
            .max(100)
            .optional(),
          dependsOnTaskIds: z.array(id).max(100).optional(),
          deferredUntil: localDate.optional(),
          recoveryReason: shortText.optional(),
          lastWorkedAt: z.string().max(64).optional(),
          origin: z.enum(["manual", "transition", "system"]).optional(),
          sourceRef: z.string().min(1).max(160).optional(),
        })
      )
      .max(2_000),
    sessions: z
      .array(
        z.object({
          id,
          subject: shortText,
          topic: shortText,
          topicId: id.optional(),
          planId: id.optional(),
          planItemId: id.optional(),
          date: localDate,
          startTime: localTime,
          duration: z.number().int().min(1).max(1_440),
          difficulty: z.enum(["easy", "medium", "hard"]),
          priority,
          notes: text,
          status: z.enum([
            "planned",
            "in_progress",
            "paused",
            "completed",
            "skipped",
            "rescheduled",
          ]),
          startedAt: z.string().max(64).optional(),
          pausedAt: z.string().max(64).optional(),
          resumedAt: z.string().max(64).optional(),
          finishedAt: z.string().max(64).optional(),
          actualDuration: z.number().int().min(1).max(1_440).optional(),
          skipReason: z
            .enum([
              "too_tired",
              "no_time",
              "higher_priority",
              "missing_materials",
              "not_ready",
              "other",
            ])
            .optional(),
          rescheduleReason: shortText.optional(),
          reflection: z
            .enum(["easy", "okay", "difficult", "still_confused"])
            .optional(),
        })
      )
      .max(WORKSPACE_STUDY_SESSION_LIMIT),
    topics: z
      .array(
        z.object({
          id,
          subject: shortText,
          name: shortText,
          source: z.enum([
            "manual",
            "exam",
            "session",
            "note",
            "flashcard",
            "quiz",
          ]),
          createdAt: z.string().max(64),
          updatedAt: z.string().max(64),
          prerequisiteTopicIds: z.array(id).max(32).optional(),
          learningObjective: shortText.optional(),
          academicClassLevel: shortText.optional(),
        })
      )
      .max(5_000)
      .default([]),
    learningEvidence: z
      .array(
        z.object({
          id,
          topicId: id,
          subject: shortText,
          kind: z.enum(["quiz", "flashcard", "practice", "study_session"]),
          score: z.number().finite().min(0).max(100).optional(),
          minutes: z.number().int().min(1).max(1_440).optional(),
          sourceId: id.optional(),
          recordedAt: z.string().max(64),
        })
      )
      .max(20_000)
      .default([]),
    studyPlans: z
      .array(
        z.object({
          id,
          title: shortText,
          startDate: localDate,
          endDate: localDate,
          availableMinutesPerDay: z.number().int().min(10).max(720),
          createdAt: z.string().max(64),
          updatedAt: z.string().max(64),
          items: z
            .array(
              z.object({
                id,
                subject: shortText,
                topic: shortText,
                topicId: id.optional(),
                date: localDate,
                startTime: localTime,
                duration: z.number().int().min(10).max(720),
                priority,
                reason: shortText,
                status: z.enum(["planned", "completed", "skipped"]),
                linkedExamId: id.optional(),
                createdAt: z.string().max(64),
                skipReason: z
                  .enum([
                    "too_tired",
                    "no_time",
                    "higher_priority",
                    "missing_materials",
                    "not_ready",
                    "other",
                  ])
                  .optional(),
                rescheduledAt: z.string().max(64).optional(),
              })
            )
            .max(WORKSPACE_STUDY_PLAN_ITEM_LIMIT),
        })
      )
      .max(100)
      .default([]),
    quizzes: z
      .array(
        z.object({
          id,
          title: shortText,
          subject: shortText,
          topic: shortText,
          topicId: id.optional(),
          source: z.enum(["manual", "ai_draft"]),
          assessmentKind: z
            .enum(["standard", "foundation", "foundation_remediation"])
            .optional(),
          foundationSourceStage: z
            .enum(["Primary", "JHS", "SHS", "Tertiary", "Other"])
            .optional(),
          foundationSourceClassLevel: shortText.optional(),
          currentAcademicClassLevel: shortText.optional(),
          createdAt: z.string().max(64),
          questions: z
            .array(
              z.object({
                id,
                prompt: text,
                type: z.enum(["multiple_choice", "true_false"]),
                options: z.array(shortText).min(2).max(6),
                correctOptionIndex: z.number().int().min(0).max(5),
                explanation: text,
                difficulty: z.enum(["easy", "medium", "hard"]).optional(),
                subtopic: shortText.optional(),
              })
            )
            .min(1)
            .max(100),
        })
      )
      .max(1_000)
      .default([]),
    quizAttempts: z
      .array(
        z.object({
          id,
          quizId: id,
          subject: shortText,
          topicId: id.optional(),
          score: z.number().finite().min(0).max(100),
          correctCount: z.number().int().min(0).max(100),
          questionCount: z.number().int().min(1).max(100),
          completedAt: z.string().max(64),
          responses: z
            .array(
              z.object({
                questionId: id,
                prompt: text,
                selectedOptionIndex: z.number().int().min(0).max(5),
                correctOptionIndex: z.number().int().min(0).max(5),
                correct: z.boolean(),
                explanation: text,
                subtopic: shortText.optional(),
              })
            )
            .max(100)
            .optional(),
        })
      )
      .max(10_000)
      .default([]),
    studyMaterials: z
      .array(
        z.object({
          id,
          title: shortText,
          subject: shortText,
          topicId: id.optional(),
          fileName: shortText,
          mimeType: z.enum(["application/pdf", "text/plain"]),
          storageKey: z.string().min(1).max(1_024),
          url: z.string().max(2_048),
          sizeBytes: z.number().int().min(1).max(3_000_000),
          addedAt: z.string().max(64),
          aiProcessingConsentAt: z.string().max(64).optional(),
          aiPracticeQuestionConsentAt: z.string().max(64).optional(),
        })
      )
      .max(WORKSPACE_STUDY_MATERIAL_LIMIT)
      .default([]),
    decks: z
      .array(
        z.object({
          id,
          name: shortText,
          subject: shortText,
          topicId: id.optional(),
          createdAt: z.string().max(64),
          cards: z
            .array(
              z.object({
                id,
                front: text,
                back: text,
                status: z.enum(["new", "easy", "difficult"]),
                dueDate: localDate.optional(),
                intervalDays: z.number().int().min(1).max(365).optional(),
                reviewCount: z.number().int().min(0).max(10_000).optional(),
                lastReviewedAt: z.string().max(64).optional(),
                nextReviewDate: localDate.optional(),
                retentionEstimate: z.number().finite().min(0).max(1).optional(),
                easeFactor: z.number().finite().min(1.3).max(3.5).optional(),
                lapses: z.number().int().min(0).max(10_000).optional(),
              })
            )
            .max(2_000),
        })
      )
      .max(WORKSPACE_DECK_LIMIT),
    exams: z
      .array(
        z.object({
          id,
          subject: shortText,
          name: shortText,
          date: localDate,
          time: localTime,
          location: shortText,
          notes: text,
          topics: z
            .array(
              z.object({
                id,
                name: shortText,
                status: z.enum([
                  "not_started",
                  "learning",
                  "revised",
                  "mastered",
                ]),
              })
            )
            .max(WORKSPACE_EXAM_TOPIC_LIMIT),
        })
      )
      .max(WORKSPACE_EXAM_LIMIT),
    events: z
      .array(
        z.object({
          id,
          title: shortText,
          subject: shortText,
          day: z.number().int().min(0).max(6),
          startTime: localTime,
          endTime: localTime,
          type: z.enum(["class", "study", "exam", "personal"]),
          location: shortText,
          notes: text,
        })
      )
      .max(WORKSPACE_TIMETABLE_EVENT_LIMIT),
    transactions: z
      .array(
        z.object({
          id,
          type: z.enum(["income", "expense"]),
          amount: z.number().finite().min(0).max(10_000_000),
          category: z.enum([
            "food",
            "transport",
            "school",
            "entertainment",
            "other",
          ]),
          label: shortText,
          date: localDate,
        })
      )
      .max(5_000),
    goals: z
      .array(
        z.object({
          id,
          name: shortText,
          target: z.number().finite().min(0).max(10_000_000),
          current: z.number().finite().min(0).max(10_000_000),
          deadline: localDate,
          category: z.enum(["study", "tasks", "flashcards", "focus", "custom"]),
          completed: z.boolean(),
          xpAwarded: z.boolean().optional(),
          xpAwardedAt: z.string().max(64).optional(),
          unit: shortText,
        })
      )
      .max(500),
    focusSessions: z
      .array(
        z.object({
          id,
          subject: shortText,
          duration: z.number().int().min(1).max(1_440),
          date: localDate,
          taskId: id.optional(),
          topicId: id.optional(),
          objective: shortText.optional(),
        })
      )
      .max(WORKSPACE_FOCUS_SESSION_LIMIT),
    notes: z
      .array(
        z.object({
          id,
          title: shortText,
          subject: shortText,
          topicId: id.optional(),
          content: text,
          pinned: z.boolean(),
          createdAt: z.string().max(64),
          updatedAt: z.string().max(64),
        })
      )
      .max(WORKSPACE_NOTE_LIMIT),
    achievements: z
      .array(
        z.object({
          id,
          name: shortText,
          description: shortText,
          unlocked: z.boolean(),
          unlockedAt: z.string().max(64).optional(),
        })
      )
      .max(200),
    notifications: z
      .array(
        z.object({
          id,
          text: shortText,
          type: z.enum(["info", "success", "warning"]),
          read: z.boolean(),
          createdAt: z.string().max(64),
        })
      )
      .max(200),
    xp: z.number().finite().min(0).max(100_000_000),
    lastActiveDay: localDate,
    streakDays: z.number().int().min(0).max(100_000),
    streakStart: localDate,
    longestStreak: z.number().int().min(0).max(100_000),
    dailyGoal: z.object({ targetMinutes: z.number().int().min(10).max(360) }),
    customReminders: z
      .array(
        z.object({
          id,
          title: shortText,
          message: shortText,
          date: localDate,
          time: localTime,
          repeat: z.enum(["once", "daily"]),
          enabled: z.boolean(),
          createdAt: z.string().max(64),
        })
      )
      .max(3),
    aiAnswerRatings: z
      .array(
        z.object({
          answerId: id,
          surface: z.enum(["lesson", "assistant"]),
          rating: z.enum(["up", "down"]),
          answerPreview: text,
          reason: z
            .enum([
              "too_vague",
              "missed_question",
              "too_complex",
              "may_be_inaccurate",
              "needs_example",
            ])
            .optional(),
          ratedAt: z.string().max(64),
        })
      )
      .max(100),
    settings: z.object({
      theme: z.enum(["light", "dark", "system"]),
      currency: z
        .enum(["GHS", "NGN", "KES", "ZAR", "USD", "GBP", "EUR", "INR"])
        .default("GHS"),
      timerPrefs: z.object({
        focus: z.number().int().min(1).max(240),
        breakLen: z.number().int().min(1).max(120),
        preset: shortText,
      }),
      notifications: z.boolean(),
      notificationPreferences,
    }),
    habits: z
      .array(
        z.object({
          id,
          name: shortText,
          emoji: z.string().max(32),
          createdAt: z.string().max(64),
        })
      )
      .max(100),
    habitLog: z.record(localDate, z.array(id).max(100)),
    friends: z
      .array(
        z.object({
          id,
          name: shortText,
          emoji: z.string().max(32),
          weeklyBase: z.number().finite().min(0).max(1_000_000),
        })
      )
      .max(100),
    dailyLessonCompletions: z.array(id).max(5_000),
    savedLessons: z
      .array(
        z.object({
          id,
          selectionKey: shortText,
          dateStr: localDate,
          subject: shortText,
          branch: shortText,
          topic: shortText,
          title: shortText,
          strapline: shortText,
          learningGoals: z.array(shortText).max(20),
          recap: text,
          savedAt: z.string().max(64),
        })
      )
      .max(1_000),
    syncTombstones: z
      .array(
        z.object({
          collection: syncTombstoneCollection,
          id,
          deletedAt: z.string().max(64),
        })
      )
      .max(20_000)
      .default([]),
  })
  .strict();

export type CanonicalStudyState = z.infer<typeof studyStateSchema>;

export function validateStudyState(input: unknown) {
  return studyStateSchema.safeParse(input);
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validDate(value: string, allowEmpty = false) {
  if (allowEmpty && value === "") return true;
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validTime(value: string, allowEmpty = false) {
  return (allowEmpty && value === "") || LOCAL_TIME_PATTERN.test(value);
}

function uniqueIds(items: Array<{ id: string }>) {
  return new Set(items.map(item => item.id)).size === items.length;
}

/**
 * Shape validation answers whether a payload can be parsed. This second layer
 * answers whether it describes a coherent workspace that can be synchronized
 * without creating impossible academic records or broken references.
 */
export function validateStudyStateSemantics(input: unknown) {
  const parsed = studyStateSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      reason: "shape validation failed",
      issues: parsed.error.issues,
    };
  const state = parsed.data;
  const fail = (reason: string) => ({ success: false as const, reason });

  if (state.profile && state.profile.subjects.some(subject => !subject.trim()))
    return fail("profile contains an empty subject");
  if (
    ![
      state.tasks,
      state.sessions,
      state.topics,
      state.studyPlans,
      state.quizzes,
      state.quizAttempts,
      state.studyMaterials,
      state.decks,
      state.exams,
      state.events,
      state.transactions,
      state.goals,
      state.focusSessions,
      state.notes,
      state.achievements,
      state.notifications,
      state.customReminders,
      state.habits,
      state.friends,
      state.savedLessons,
    ].every(uniqueIds)
  )
    return fail("workspace contains duplicate record identifiers");

  const topicIds = new Set([
    ...state.topics.map(topic => topic.id),
    ...state.exams.flatMap(exam => exam.topics.map(topic => topic.id)),
  ]);
  const taskIds = new Set(state.tasks.map(task => task.id));
  const quizIds = new Set(state.quizzes.map(quiz => quiz.id));
  const habitIds = new Set(state.habits.map(habit => habit.id));

  // Tombstones are authoritative deletion markers. A canonical workspace must
  // never contain both a live record and a deletion marker for the same stable
  // identifier; allowing both would create an ambiguous snapshot and can let a
  // stale replica resurrect data after a later merge.
  const tombstoneKeys = new Set<string>();
  for (const tombstone of state.syncTombstones) {
    const key = `${tombstone.collection}:${tombstone.id}`;
    if (tombstoneKeys.has(key))
      return fail(`workspace contains duplicate tombstone ${key}`);
    tombstoneKeys.add(key);
  }
  const liveCollectionIds: Array<[string, Set<string>]> = [
    ["tasks", taskIds],
    ["sessions", new Set(state.sessions.map(item => item.id))],
    ["topics", new Set(state.topics.map(item => item.id))],
    ["learningEvidence", new Set(state.learningEvidence.map(item => item.id))],
    ["studyPlans", new Set(state.studyPlans.map(item => item.id))],
    ["quizzes", quizIds],
    ["quizAttempts", new Set(state.quizAttempts.map(item => item.id))],
    ["studyMaterials", new Set(state.studyMaterials.map(item => item.id))],
    ["decks", new Set(state.decks.map(item => item.id))],
    ["exams", new Set(state.exams.map(item => item.id))],
    ["events", new Set(state.events.map(item => item.id))],
    ["transactions", new Set(state.transactions.map(item => item.id))],
    ["goals", new Set(state.goals.map(item => item.id))],
    ["focusSessions", new Set(state.focusSessions.map(item => item.id))],
    ["notes", new Set(state.notes.map(item => item.id))],
    ["achievements", new Set(state.achievements.map(item => item.id))],
    ["notifications", new Set(state.notifications.map(item => item.id))],
    ["customReminders", new Set(state.customReminders.map(item => item.id))],
    ["habits", habitIds],
    ["friends", new Set(state.friends.map(item => item.id))],
    ["savedLessons", new Set(state.savedLessons.map(item => item.id))],
  ];
  for (const [collection, ids] of liveCollectionIds)
    for (const id of ids)
      if (tombstoneKeys.has(`${collection}:${id}`))
        return fail(
          `workspace contains live ${collection} record ${id} with a tombstone`
        );

  const nestedIds: Array<[string, Set<string>]> = [
    [
      "studyPlanItems",
      new Set(
        state.studyPlans.flatMap(plan => plan.items.map(item => item.id))
      ),
    ],
    [
      "examTopics",
      new Set(state.exams.flatMap(exam => exam.topics.map(topic => topic.id))),
    ],
    [
      "cards",
      new Set(state.decks.flatMap(deck => deck.cards.map(card => card.id))),
    ],
  ];
  for (const [collection, ids] of nestedIds)
    for (const id of ids)
      if (tombstoneKeys.has(`${collection}:${id}`))
        return fail(
          `workspace contains live ${collection} record ${id} with a tombstone`
        );

  for (const task of state.tasks) {
    if (
      !validDate(task.dueDate, true) ||
      (task.topicId && !topicIds.has(task.topicId)) ||
      task.dependsOnTaskIds?.some(id => id === task.id || !taskIds.has(id))
    )
      return fail(`task ${task.id} has an invalid date, topic, or dependency`);
    if (task.status === "completed" && !task.completedAt)
      return fail(`completed task ${task.id} has no completion timestamp`);
    if (task.status !== "completed" && task.completedAt)
      return fail(`incomplete task ${task.id} has a completion timestamp`);
  }
  for (const session of state.sessions) {
    if (
      !validDate(session.date) ||
      !validTime(session.startTime) ||
      (session.topicId && !topicIds.has(session.topicId)) ||
      (session.actualDuration !== undefined &&
        session.actualDuration > session.duration)
    )
      return fail(`study session ${session.id} is semantically invalid`);
  }
  for (const plan of state.studyPlans) {
    if (
      !validDate(plan.startDate) ||
      !validDate(plan.endDate) ||
      plan.startDate > plan.endDate
    )
      return fail(`study plan ${plan.id} has an invalid date range`);
    if (
      plan.items.some(
        item =>
          !validDate(item.date) ||
          item.date < plan.startDate ||
          item.date > plan.endDate ||
          !validTime(item.startTime) ||
          (item.topicId && !topicIds.has(item.topicId))
      )
    )
      return fail(`study plan ${plan.id} contains an invalid item`);
  }
  for (const quiz of state.quizzes) {
    if (
      quiz.questions.some(
        question =>
          new Set(question.options).size !== question.options.length ||
          question.correctOptionIndex >= question.options.length ||
          (question.type === "true_false" && question.options.length !== 2)
      )
    )
      return fail(`quiz ${quiz.id} contains an ambiguous or invalid question`);
  }
  for (const attempt of state.quizAttempts) {
    if (
      !quizIds.has(attempt.quizId) ||
      attempt.correctCount > attempt.questionCount ||
      (attempt.responses && attempt.responses.length !== attempt.questionCount)
    )
      return fail(
        `quiz attempt ${attempt.id} has an invalid result relationship`
      );
  }
  for (const exam of state.exams)
    if (
      !validDate(exam.date) ||
      !validTime(exam.time, true) ||
      !uniqueIds(exam.topics)
    )
      return fail(`exam ${exam.id} is semantically invalid`);
  for (const event of state.events)
    if (
      !validTime(event.startTime) ||
      !validTime(event.endTime) ||
      event.startTime >= event.endTime
    )
      return fail(`timetable event ${event.id} has an invalid time range`);
  for (const goal of state.goals)
    if (goal.current > goal.target || !validDate(goal.deadline, true))
      return fail(
        `goal ${goal.id} exceeds its target or has an invalid deadline`
      );
  for (const [date, completed] of Object.entries(state.habitLog))
    if (
      !validDate(date) ||
      new Set(completed).size !== completed.length ||
      completed.some(id => !habitIds.has(id))
    )
      return fail(`habit log ${date} contains an invalid completion`);
  for (const tombstone of state.syncTombstones) {
    const time = Date.parse(tombstone.deletedAt);
    if (!Number.isFinite(time) || !tombstone.deletedAt.includes("T"))
      return fail(
        `tombstone ${tombstone.collection}:${tombstone.id} has an invalid timestamp`
      );
  }
  return { success: true as const, data: state };
}
