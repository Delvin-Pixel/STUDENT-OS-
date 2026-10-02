import { describe, expect, it } from "vitest";
import type { AssessmentRemediationPlan } from "./misconceptionRemediation";
import {
  createRemediationExecutionPlan,
  getNextRemediationBlock,
  reconcileRemediationExecution,
} from "./remediationExecution";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

const baseState = (): StudyState => ({
  foundationChecks: [],
  profile: null,
  onboarded: true,
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
  achievements: [],
  notifications: [],
  xp: 0,
  lastActiveDay: "2026-09-02",
  streakDays: 1,
  streakStart: "2026-09-02",
  longestStreak: 1,
  dailyGoal: { targetMinutes: 30 },
  customReminders: [],
  aiAnswerRatings: [],
  settings: {
    theme: "system",
    currency: "GHS",
    timerPrefs: emptyState().settings.timerPrefs,
    notifications: false,
    notificationPreferences: emptyState().settings.notificationPreferences,
  },
  habits: [],
  habitLog: {},
  friends: [],
  dailyLessonCompletions: [],
  savedLessons: [],
  syncTombstones: [],
});

const remediation: AssessmentRemediationPlan = {
  topicId: "motion",
  status: "targeted",
  reason: "concept_signal",
  nodes: [
    {
      topicId: "motion",
      topic: "Motion",
      kind: "concept",
      action: "practice",
      route: "/quizzes",
      duration: 60,
      reason: "Repeated misses require focused practice.",
    },
  ],
  summary: "Target Motion.",
};

describe("B42 remediation execution", () => {
  it("bounds an oversized remediation block", () => {
    const plan = createRemediationExecutionPlan(
      baseState(),
      remediation,
      "2026-09-02T10:00:00.000Z"
    );
    expect(plan.steps[0].plannedMinutes).toBe(45);
    expect(getNextRemediationBlock(plan, 20)?.minutes).toBe(20);
  });

  it("does not treat execution completion as learning proof", () => {
    const state = baseState();
    state.sessions.push({
      id: "s1",
      subject: "Physics",
      topic: "Motion",
      topicId: "motion",
      date: "2026-09-02",
      startTime: "10:00",
      duration: 30,
      difficulty: "medium",
      priority: "high",
      notes: "",
      status: "completed",
      actualDuration: 30,
    });
    const plan = createRemediationExecutionPlan(state, remediation);
    expect(plan.status).toBe("needs_reassessment");
    expect(state.learningEvidence).toHaveLength(0);
  });

  it("reconciles an active block without marking it learned", () => {
    const state = baseState();
    state.sessions.push({
      id: "s1",
      subject: "Physics",
      topic: "Motion",
      topicId: "motion",
      date: "2026-09-02",
      startTime: "10:00",
      duration: 20,
      difficulty: "medium",
      priority: "high",
      notes: "",
      status: "in_progress",
    });
    const plan = reconcileRemediationExecution(
      state,
      createRemediationExecutionPlan(baseState(), remediation)
    );
    expect(plan.status).toBe("in_progress");
    expect(plan.nextStepId).toBeDefined();
  });
});
