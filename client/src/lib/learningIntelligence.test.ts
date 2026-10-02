import { describe, expect, it } from "vitest";
import {
  createAdaptiveExamPlan,
  getDueReviewQueue,
  getExamReadiness,
  getExamStrategy,
  getExecutionCoach,
  getExecutionFeedback,
  getKnowledgeGaps,
  getLearningPath,
  getNextActionHref,
  getRankedNextActions,
  getRecoveryRecommendation,
  getTopicMastery,
  getTopicRecommendationHref,
  masteryRecencyWeight,
  reassessLearningPath,
  reassessTopicMastery,
  rebalanceMissedPlanItems,
} from "./learningIntelligence";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

function makeState(overrides: Partial<StudyState> = {}): StudyState {
  return { ...emptyState(), ...overrides };
}

function topicState() {
  const state = emptyState();
  state.topics = [
    {
      id: "waves",
      subject: "Physics",
      name: "Waves",
      source: "manual",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    },
  ];
  return state;
}

describe("learning intelligence", () => {
  it("uses the learner-local calendar date of timestamped evidence for recency thresholds", () => {
    expect(
      masteryRecencyWeight(
        new Date(2026, 7, 17, 23, 30).toISOString(),
        "2026-08-24"
      )
    ).toBe(1);
    expect(
      masteryRecencyWeight(
        new Date(2026, 7, 16, 23, 30).toISOString(),
        "2026-08-24"
      )
    ).toBe(0.7);
  });

  it("uses assessment evidence rather than study minutes as the primary mastery signal", () => {
    const state = topicState();
    state.learningEvidence = [
      {
        id: "quiz-low",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 40,
        recordedAt: "2026-08-22",
      },
      {
        id: "session",
        topicId: "waves",
        subject: "Physics",
        kind: "study_session",
        minutes: 240,
        recordedAt: "2026-08-22",
      },
    ];
    const mastery = getTopicMastery(state)[0];
    expect(mastery.score).toBeLessThan(50);
    expect(mastery.directEvidenceCount).toBe(1);
    expect(mastery.estimated).toBe(false);
  });

  it("ranks due work ahead of a weak topic while retaining the weak topic as the next study action", () => {
    const state = topicState();
    state.tasks = [
      {
        id: "task",
        title: "Submit lab report",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-22",
        priority: "high",
        status: "todo",
        createdAt: "2026-08-20",
      },
    ];
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-28",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "not_started" }],
      },
    ];
    const actions = getRankedNextActions(state, "2026-08-22");
    expect(actions[0]?.kind).toBe("task");
    const examTopicAction = actions.find(
      action => action.id === "exam-topic:exam:waves"
    );
    expect(examTopicAction).toMatchObject({
      topicId: "waves",
      subject: "Physics",
      topic: "Waves",
    });
    expect(examTopicAction && getNextActionHref(examTopicAction)).toBe(
      "/study?topicId=waves"
    );
    expect(getTopicRecommendationHref("/quizzes", "waves & sound")).toBe(
      "/quizzes?topicId=waves%20%26%20sound"
    );
  });

  it("includes near-term deadlines in the actionable queue", () => {
    const state = topicState();
    state.tasks = [
      {
        id: "tomorrow-task",
        title: "Submit lab report",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-23",
        priority: "high",
        status: "todo",
        createdAt: "2026-08-19",
      },
    ];
    const action = getRankedNextActions(state, "2026-08-22").find(
      entry => entry.id === "task:tomorrow-task"
    );
    expect(action).toMatchObject({
      kind: "task",
      detail: "Due tomorrow",
      subject: "Physics",
    });
  });

  it("derives overdue detail from the supplied planning date rather than the runtime clock", () => {
    const state = topicState();
    state.tasks = [
      {
        id: "overdue-task",
        title: "Submit lab report",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-20",
        priority: "high",
        status: "todo",
        createdAt: "2026-08-19",
      },
    ];
    state.sessions = [
      {
        id: "overdue-session",
        subject: "Physics",
        topic: "Waves",
        date: "2026-08-21",
        startTime: "16:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
    ];

    const actions = getRankedNextActions(state, "2026-08-23");

    expect(
      actions.find(action => action.id === "task:overdue-task")?.detail
    ).toBe("3 days overdue");
    expect(
      actions.find(action => action.id === "session:overdue-session")?.detail
    ).toBe("2 days overdue");
  });

  it("derives exam recommendation visibility and countdown from the supplied planning date rather than the runtime clock", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-28",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "not_started" }],
      },
    ];

    const action = getRankedNextActions(state, "2026-08-22").find(
      entry => entry.id === "exam-topic:exam:waves"
    );

    expect(action?.detail).toBe("Mock in 6 days");
  });

  it("keeps blocked and deliberately deferred tasks out of the actionable next-step queue while prioritising partial work", () => {
    const state = topicState();
    state.tasks = [
      {
        id: "prerequisite",
        title: "Find sources",
        description: "",
        subject: "Physics",
        dueDate: "",
        priority: "medium",
        status: "todo",
        createdAt: "",
      },
      {
        id: "blocked",
        title: "Write report",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-22",
        priority: "high",
        status: "todo",
        createdAt: "",
        dependsOnTaskIds: ["prerequisite"],
      },
      {
        id: "deferred",
        title: "Archive notes",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-22",
        priority: "high",
        status: "todo",
        createdAt: "",
        deferredUntil: "2026-08-25",
      },
      {
        id: "partial",
        title: "Continue calculation",
        description: "",
        subject: "Physics",
        dueDate: "",
        priority: "medium",
        status: "in_progress",
        createdAt: "",
        progressPercent: 30,
        estimatedMinutes: 45,
        actualMinutes: 15,
      },
    ];
    const actions = getRankedNextActions(state, "2026-08-22");
    expect(actions[0]?.id).toBe("task:partial");
    expect(actions.some(action => action.id === "task:blocked")).toBe(false);
    expect(actions.some(action => action.id === "task:deferred")).toBe(false);
  });

  it("marks checklist-only topic strength as an estimate until direct learning evidence exists", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-28",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "learning" }],
      },
    ];
    const mastery = getTopicMastery(state)[0];
    expect(mastery.score).toBe(45);
    expect(mastery.estimated).toBe(true);
  });

  it("does not let a manual mastered label manufacture strong readiness or remove the topic from revision planning", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-25",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "mastered" }],
      },
    ];

    const mastery = getTopicMastery(state)[0];
    const briefing = getExamReadiness(state, "exam", "2026-08-22");
    const plan = createAdaptiveExamPlan(state, "exam", 60, "2026-08-22");

    expect(mastery).toMatchObject({
      score: 55,
      estimated: true,
      directEvidenceCount: 0,
    });
    expect(briefing).toMatchObject({
      readiness: 44,
      evidenceBackedTopics: 0,
      needsAttentionTopics: ["Waves"],
    });
    expect(briefing?.strongTopics).toEqual([]);
    expect(plan?.items.length).toBeGreaterThan(0);
    expect(plan?.items.every(item => item.topicId === "waves")).toBe(true);
  });

  it("creates a finite exam plan within remaining daily capacity and prioritises the weakest topic", () => {
    const state = topicState();
    state.topics.push({
      id: "mechanics",
      subject: "Physics",
      name: "Mechanics",
      source: "manual",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    });
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-25",
        time: "",
        location: "",
        notes: "",
        topics: [
          { id: "waves", name: "Waves", status: "not_started" },
          { id: "mechanics", name: "Mechanics", status: "revised" },
        ],
      },
    ];
    state.sessions = [
      {
        id: "existing",
        subject: "English",
        topic: "Essay",
        date: "2026-08-22",
        startTime: "16:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
    ];
    const plan = createAdaptiveExamPlan(state, "exam", 60, "2026-08-22");
    expect(plan).not.toBeNull();
    expect(plan?.items[0]?.topicId).toBe("waves");
    expect(
      plan?.items
        .filter(item => item.date === "2026-08-22")
        .reduce((sum, item) => sum + item.duration, 0)
    ).toBeLessThanOrEqual(30);
    expect(plan?.items.every(item => item.date <= "2026-08-24")).toBe(true);
  });

  it("reserves recurring timetable time and schedules revision only in the remaining free slot", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-23",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "not_started" }],
      },
    ];
    state.events = [
      {
        id: "class",
        title: "Lab",
        subject: "Physics",
        day: 5,
        startTime: "18:00",
        endTime: "18:30",
        type: "class",
        location: "",
        notes: "",
      },
    ];

    const plan = createAdaptiveExamPlan(state, "exam", 60, "2026-08-22");
    const saturdayItems =
      plan?.items.filter(item => item.date === "2026-08-22") ?? [];

    expect(saturdayItems).toHaveLength(1);
    expect(saturdayItems[0]).toMatchObject({
      startTime: "18:30",
      duration: 30,
      topicId: "waves",
    });
  });

  it("reserves adaptive-plan capacity for the remaining estimate of a due task and frees it as real work is recorded", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-23",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "not_started" }],
      },
    ];
    state.tasks = [
      {
        id: "lab",
        title: "Lab report",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-22",
        priority: "high",
        status: "in_progress",
        createdAt: "",
        estimatedMinutes: 60,
        actualMinutes: 30,
        progressPercent: 50,
      },
    ];
    const plan = createAdaptiveExamPlan(state, "exam", 60, "2026-08-22");
    expect(
      plan?.items
        .filter(item => item.date === "2026-08-22")
        .reduce((sum, item) => sum + item.duration, 0)
    ).toBeLessThanOrEqual(30);
  });

  it("assigns distinct non-overlapping evening times when an adaptive plan creates multiple blocks on one day", () => {
    const state = topicState();
    state.topics.push({
      id: "mechanics",
      subject: "Physics",
      name: "Mechanics",
      source: "manual",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    });
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-23",
        time: "",
        location: "",
        notes: "",
        topics: [
          { id: "waves", name: "Waves", status: "not_started" },
          { id: "mechanics", name: "Mechanics", status: "revised" },
        ],
      },
    ];
    const plan = createAdaptiveExamPlan(state, "exam", 90, "2026-08-22");
    const sameDay =
      plan?.items.filter(item => item.date === "2026-08-22") ?? [];
    expect(sameDay.length).toBeGreaterThan(1);
    expect(new Set(sameDay.map(item => item.startTime)).size).toBe(
      sameDay.length
    );
    expect(sameDay[0]?.startTime).toBe("18:00");
  });

  it("rebalances only missed plan work into real remaining capacity while retaining completed items", () => {
    const state = topicState();
    state.sessions = [
      {
        id: "busy",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-22",
        startTime: "18:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
    ];
    const plan = {
      id: "plan",
      title: "Physics",
      startDate: "2026-08-20",
      endDate: "2026-08-23",
      availableMinutesPerDay: 60,
      createdAt: "",
      updatedAt: "",
      items: [
        {
          id: "done",
          subject: "Physics",
          topic: "Waves",
          date: "2026-08-20",
          startTime: "18:00",
          duration: 30,
          priority: "high" as const,
          reason: "Done",
          status: "completed" as const,
          createdAt: "",
        },
        {
          id: "missed",
          subject: "Physics",
          topic: "Waves",
          date: "2026-08-21",
          startTime: "18:00",
          duration: 30,
          priority: "high" as const,
          reason: "Missed",
          status: "planned" as const,
          createdAt: "",
        },
      ],
    };
    const result = rebalanceMissedPlanItems(plan, state, "2026-08-22");
    expect(result.skippedItemIds).toEqual(["missed"]);
    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]?.date).toBe("2026-08-22");
    expect(result.additions[0]?.startTime).toBe("18:30");
    expect(result.additions[0]?.reason).toContain("Rescheduled");
  });

  it("does not create an overflow recovery item when a canonical study plan already has 2,000 items", () => {
    const state = topicState();
    const completedItems = Array.from({ length: 1_999 }, (_, index) => ({
      id: `done-${index}`,
      subject: "Physics",
      topic: "Waves",
      date: "2026-08-20",
      startTime: "18:00",
      duration: 30,
      priority: "high" as const,
      reason: "Done",
      status: "completed" as const,
      createdAt: "",
    }));
    const plan = {
      id: "plan",
      title: "Physics",
      startDate: "2026-08-20",
      endDate: "2026-08-22",
      availableMinutesPerDay: 60,
      createdAt: "",
      updatedAt: "",
      items: [
        ...completedItems,
        {
          id: "missed",
          subject: "Physics",
          topic: "Waves",
          date: "2026-08-21",
          startTime: "18:00",
          duration: 30,
          priority: "high" as const,
          reason: "Missed",
          status: "planned" as const,
          createdAt: "",
        },
      ],
    };

    const result = rebalanceMissedPlanItems(plan, state, "2026-08-22");

    expect(result.skippedItemIds).toEqual(["missed"]);
    expect(result.additions).toEqual([]);
    expect(result.unallocatedCount).toBe(1);
  });

  it("does not reschedule missed revision into a recurring timetable block", () => {
    const state = topicState();
    state.events = [
      {
        id: "class",
        title: "Lab",
        subject: "Physics",
        day: 5,
        startTime: "18:00",
        endTime: "18:30",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    const plan = {
      id: "plan",
      title: "Physics",
      startDate: "2026-08-20",
      endDate: "2026-08-22",
      availableMinutesPerDay: 60,
      createdAt: "",
      updatedAt: "",
      items: [
        {
          id: "missed",
          subject: "Physics",
          topic: "Waves",
          date: "2026-08-21",
          startTime: "18:00",
          duration: 30,
          priority: "high" as const,
          reason: "Missed",
          status: "planned" as const,
          createdAt: "",
        },
      ],
    };

    const result = rebalanceMissedPlanItems(plan, state, "2026-08-22");

    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]).toMatchObject({
      date: "2026-08-22",
      startTime: "18:30",
      duration: 30,
    });
  });

  it("selects an in-progress session through the same ranked action engine before lower-urgency planned work", () => {
    const state = topicState();
    state.sessions = [
      {
        id: "planned",
        subject: "Physics",
        topic: "Waves",
        date: "2026-08-22",
        startTime: "18:00",
        duration: 40,
        difficulty: "hard",
        priority: "high",
        notes: "Exam review",
        status: "planned",
      },
      {
        id: "active",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-22",
        startTime: "16:00",
        duration: 25,
        difficulty: "medium",
        priority: "medium",
        notes: "Finish the exercise",
        status: "in_progress",
        startedAt: "2026-08-22T16:00:00.000Z",
      },
    ];
    const coach = getExecutionCoach(state, "2026-08-22");
    expect(coach?.session.id).toBe("active");
    expect(coach?.action.reason).toContain("Finish the exercise");
  });

  it("excludes skipped and rescheduled sessions from the execution queue and does not infer learning evidence from them", () => {
    const state = topicState();
    state.sessions = [
      {
        id: "skipped",
        subject: "Physics",
        topic: "Waves",
        topicId: "waves",
        date: "2026-08-22",
        startTime: "16:00",
        duration: 25,
        difficulty: "medium",
        priority: "high",
        notes: "",
        status: "skipped",
        skipReason: "no_time",
      },
      {
        id: "moved",
        subject: "Physics",
        topic: "Waves",
        topicId: "waves",
        date: "2026-08-22",
        startTime: "17:00",
        duration: 25,
        difficulty: "medium",
        priority: "high",
        notes: "",
        status: "rescheduled",
      },
    ];
    expect(getExecutionCoach(state, "2026-08-22")).toBeNull();
    expect(getTopicMastery(state)[0]?.evidenceCount).toBe(0);
  });

  it("derives an actionable exam briefing from current topic coverage and direct mastery evidence", () => {
    const state = topicState();
    state.topics.push({
      id: "mechanics",
      subject: "Physics",
      name: "Mechanics",
      source: "manual",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    });
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-28",
        time: "",
        location: "",
        notes: "",
        topics: [
          { id: "waves", name: "Waves", status: "learning" },
          { id: "mechanics", name: "Mechanics", status: "revised" },
        ],
      },
    ];
    state.learningEvidence = [
      {
        id: "wave-check",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 42,
        recordedAt: "2026-08-22",
      },
      {
        id: "mech-check",
        topicId: "mechanics",
        subject: "Physics",
        kind: "quiz",
        score: 84,
        recordedAt: "2026-08-22",
      },
    ];
    const briefing = getExamReadiness(state, "exam", "2026-08-22");
    expect(briefing?.coverage).toBe(100);
    expect(briefing?.evidenceBackedTopics).toBe(2);
    expect(briefing?.needsAttentionTopics).toEqual(["Waves"]);
    expect(briefing?.strongTopics).toEqual(["Mechanics"]);
    expect(briefing?.recommendedSessions).toBeGreaterThan(0);
  });

  it("groups only due spaced-repetition cards into a cross-subject review queue", () => {
    const state = topicState();
    state.decks = [
      {
        id: "physics",
        name: "Waves",
        subject: "Physics",
        createdAt: "",
        cards: [
          {
            id: "due",
            front: "Q",
            back: "A",
            status: "difficult",
            nextReviewDate: "2026-08-22",
          },
          {
            id: "future",
            front: "Q",
            back: "A",
            status: "easy",
            nextReviewDate: "2026-08-24",
          },
        ],
      },
      {
        id: "chemistry",
        name: "Atoms",
        subject: "Chemistry",
        createdAt: "",
        cards: [{ id: "new", front: "Q", back: "A", status: "new" }],
      },
    ];
    const queue = getDueReviewQueue(state, "2026-08-22");
    expect(queue.total).toBe(2);
    expect(queue.subjects).toEqual([
      { subject: "Chemistry", count: 1, deckIds: ["chemistry"] },
      { subject: "Physics", count: 1, deckIds: ["physics"] },
    ]);
  });

  it("uses next-review dates consistently so future-scheduled cards do not appear as due ranked actions", () => {
    const state = topicState();
    state.decks = [
      {
        id: "physics",
        name: "Waves",
        subject: "Physics",
        createdAt: "",
        cards: [
          {
            id: "future",
            front: "Q",
            back: "A",
            status: "easy",
            dueDate: "2026-08-20",
            nextReviewDate: "2026-08-24",
          },
        ],
      },
    ];
    expect(getDueReviewQueue(state, "2026-08-22").total).toBe(0);
    expect(
      getRankedNextActions(state, "2026-08-22").some(
        action => action.id === "flashcards:due"
      )
    ).toBe(false);
  });
});

describe("B31 evidence → mastery signal", () => {
  it("exposes confidence, freshness, decay, readiness, and exam pressure separately", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-09-05",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "learning" }],
      },
    ];
    state.learningEvidence = [
      {
        id: "old",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 80,
        recordedAt: "2026-07-01",
      },
      {
        id: "recent",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 60,
        recordedAt: "2026-09-02",
      },
    ];
    const mastery = getTopicMastery(state, "2026-09-02")[0];
    expect(mastery?.confidence).toBe(84);
    expect(mastery?.confidence).toBeLessThan(mastery?.freshness ?? 0);
    expect(mastery?.freshness).toBe(100);
    expect(mastery?.decayMultiplier).toBe(1);
    expect(mastery?.latestDirectScore).toBe(60);
    expect(mastery?.readiness).toBeLessThanOrEqual(mastery?.score ?? 0);
    expect(mastery?.examPressure).toBe(95);
  });

  it("does not call checklist or study-time signals high-confidence mastery", () => {
    const state = topicState();
    state.learningEvidence = [
      {
        id: "study",
        topicId: "waves",
        subject: "Physics",
        kind: "study_session",
        minutes: 120,
        recordedAt: "2026-09-02",
      },
    ];
    const mastery = getTopicMastery(state, "2026-09-02")[0];
    expect(mastery?.estimated).toBe(true);
    expect(mastery?.directEvidenceCount).toBe(0);
    expect(mastery?.confidence).toBe(35);
  });
});

describe("B32 mastery → exam readiness → next best action", () => {
  it("ranks weak, exam-pressured topics ahead of already-strong topics", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Final",
        date: "2026-09-05",
        time: "",
        location: "",
        notes: "",
        topics: [
          { id: "waves", name: "Waves", status: "learning" },
          { id: "mechanics", name: "Mechanics", status: "mastered" },
        ],
      },
    ];
    state.learningEvidence = [
      {
        id: "waves-check",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 38,
        recordedAt: "2026-09-02",
      },
      {
        id: "mechanics-check",
        topicId: "mechanics",
        subject: "Physics",
        kind: "quiz",
        score: 92,
        recordedAt: "2026-09-02",
      },
    ];
    const strategy = getExamStrategy(state, "exam", "2026-09-02");
    expect(strategy[0]?.topicId).toBe("waves");
    expect(strategy[0]?.action).toBe("learn");
    expect(strategy[0]?.examPressure).toBe(95);
  });

  it("surfaces exam-level confidence and a concrete next move", () => {
    const state = topicState();
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-09-05",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "learning" }],
      },
    ];
    state.learningEvidence = [
      {
        id: "waves-check",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 42,
        recordedAt: "2026-09-02",
      },
    ];
    const briefing = getExamReadiness(state, "exam", "2026-09-02");
    expect(briefing?.highPriorityTopics).toBe(1);
    expect(briefing?.confidence).toBeGreaterThanOrEqual(60);
    expect(briefing?.nextMove).toMatchObject({
      topicId: "waves",
      duration: 45,
    });
  });
});

describe("B34 execution feedback loop", () => {
  it("reports no-time pressure and a preferred duration for planning", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-09-01",
          startTime: "18:00",
          duration: 45,
          actualDuration: 30,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "completed",
          reflection: "okay",
        },
        {
          id: "s2",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-31",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "skipped",
          skipReason: "no_time",
        },
        {
          id: "s3",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-30",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "completed",
          actualDuration: 30,
          reflection: "easy",
        },
      ],
    });
    const feedback = getExecutionFeedback(state, "t1");
    expect(feedback.noTimeSkipRate).toBe(100);
    expect(feedback.preferredDuration).toBe(30);
    expect(feedback.executionFit).toBeLessThan(100);
  });

  it("detects recovery pressure from repeated skips and reschedules", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-31",
          startTime: "18:00",
          duration: 40,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "skipped",
          skipReason: "no_time",
        },
        {
          id: "s2",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-30",
          startTime: "18:00",
          duration: 40,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "rescheduled",
          rescheduleReason: "Busy",
        },
      ],
    });
    const feedback = getExecutionFeedback(state, "t1");
    expect(feedback.signal).toBe("recover");
    expect(feedback.suggestedDurationDelta).toBeLessThan(0);
  });

  it("detects repeated struggle and shortens the next block", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-31",
          startTime: "18:00",
          duration: 45,
          actualDuration: 40,
          difficulty: "hard",
          priority: "high",
          notes: "",
          status: "completed",
          reflection: "still_confused",
        },
        {
          id: "s2",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-30",
          startTime: "18:00",
          duration: 45,
          actualDuration: 42,
          difficulty: "hard",
          priority: "high",
          notes: "",
          status: "completed",
          reflection: "difficult",
        },
      ],
    });
    const feedback = getExecutionFeedback(state, "t1");
    expect(feedback.signal).toBe("shorten");
    expect(feedback.struggleRate).toBe(100);
  });
});

describe("B36 knowledge-gap detection", () => {
  it("prefers a weak explicit prerequisite over the struggling parent topic", () => {
    const state = topicState();
    state.topics = [
      {
        id: "motion",
        subject: "Physics",
        name: "Motion",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["algebra"],
        learningObjective: "Interpret equations of motion",
      },
      {
        id: "algebra",
        subject: "Physics",
        name: "Algebra for Physics",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    state.learningEvidence = [
      {
        id: "e1",
        topicId: "motion",
        subject: "Physics",
        kind: "quiz",
        score: 58,
        recordedAt: "2026-09-01",
      },
      {
        id: "e2",
        topicId: "algebra",
        subject: "Physics",
        kind: "quiz",
        score: 25,
        recordedAt: "2026-09-01",
      },
    ];
    const gaps = getKnowledgeGaps(state, "motion", "2026-09-02");
    expect(gaps[0]).toMatchObject({
      topicId: "algebra",
      kind: "prerequisite",
      severity: "high",
      route: "/quizzes",
    });
  });

  it("falls back to a direct topic gap when no prerequisite is weak", () => {
    const state = topicState();
    state.learningEvidence = [
      {
        id: "e1",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 52,
        recordedAt: "2026-09-01",
      },
    ];
    expect(getKnowledgeGaps(state, "waves", "2026-09-02")[0]).toMatchObject({
      topicId: "waves",
      kind: "direct",
    });
  });

  it("returns no gap for a sufficiently ready topic", () => {
    const state = topicState();
    state.learningEvidence = [
      {
        id: "e1",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 92,
        recordedAt: "2026-09-01",
      },
      {
        id: "e2",
        topicId: "waves",
        subject: "Physics",
        kind: "practice",
        score: 90,
        recordedAt: "2026-09-01",
      },
    ];
    expect(getKnowledgeGaps(state, "waves", "2026-09-02")).toEqual([]);
  });
});

describe("B35 recovery intelligence", () => {
  it("retrieves missing material before repeating a blocked topic", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-09-01",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "skipped",
          skipReason: "missing_materials",
        },
      ],
    });
    const recovery = getRecoveryRecommendation(state, "t1");
    expect(recovery).toMatchObject({
      kind: "retrieve_material",
      route: "/study-materials",
    });
  });

  it("uses prerequisite review when the learner says they are not ready", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-09-01",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "skipped",
          skipReason: "not_ready",
        },
      ],
    });
    const recovery = getRecoveryRecommendation(state, "t1");
    expect(recovery).toMatchObject({
      kind: "prerequisite_review",
      route: "/study",
    });
    expect(recovery?.duration).toBeLessThanOrEqual(25);
  });

  it("reduces commitment after repeated time pressure", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-09-01",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "skipped",
          skipReason: "no_time",
        },
        {
          id: "s2",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-31",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "rescheduled",
          rescheduleReason: "Busy",
        },
        {
          id: "s3",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-30",
          startTime: "18:00",
          duration: 45,
          difficulty: "medium",
          priority: "high",
          notes: "",
          status: "skipped",
          skipReason: "no_time",
        },
      ],
    });
    const recovery = getRecoveryRecommendation(state, "t1");
    expect(recovery?.kind).toBe("reschedule");
    expect(recovery?.duration).toBeLessThan(30);
  });

  it("changes method after repeated confusion instead of only increasing time", () => {
    const state = makeState({
      sessions: [
        {
          id: "s1",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-09-01",
          startTime: "18:00",
          duration: 45,
          actualDuration: 35,
          difficulty: "hard",
          priority: "high",
          notes: "",
          status: "completed",
          reflection: "still_confused",
        },
        {
          id: "s2",
          subject: "Math",
          topic: "Algebra",
          topicId: "t1",
          date: "2026-08-31",
          startTime: "18:00",
          duration: 45,
          actualDuration: 35,
          difficulty: "hard",
          priority: "high",
          notes: "",
          status: "completed",
          reflection: "difficult",
        },
      ],
    });
    const recovery = getRecoveryRecommendation(state, "t1");
    expect(recovery).toMatchObject({
      kind: "change_method",
      route: "/quizzes",
    });
  });

  it("does not manufacture recovery without execution evidence", () => {
    const recovery = getRecoveryRecommendation(makeState(), "t1");
    expect(recovery).toBeNull();
  });
});

describe("B37 learning path", () => {
  it("orders weak prerequisites before the target and uses evidence to choose actions", () => {
    const state = topicState();
    state.topics = [
      {
        id: "motion",
        subject: "Physics",
        name: "Motion",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["algebra"],
      },
      {
        id: "algebra",
        subject: "Physics",
        name: "Algebra",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["numbers"],
      },
      {
        id: "numbers",
        subject: "Physics",
        name: "Numbers",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    state.learningEvidence = [
      {
        id: "e1",
        topicId: "numbers",
        subject: "Physics",
        kind: "quiz",
        score: 85,
        recordedAt: "2026-09-01",
      },
      {
        id: "e2",
        topicId: "algebra",
        subject: "Physics",
        kind: "quiz",
        score: 45,
        recordedAt: "2026-09-01",
      },
      {
        id: "e3",
        topicId: "motion",
        subject: "Physics",
        kind: "quiz",
        score: 40,
        recordedAt: "2026-09-01",
      },
    ];
    const path = getLearningPath(state, "motion", "2026-09-02");
    expect(path?.status).toBe("needs_prerequisite");
    expect(path?.steps.map(step => step.topicId)).toEqual([
      "algebra",
      "motion",
    ]);
    expect(path?.steps[0].action).toBe("review");
    expect(path?.steps[1].action).toBe("practice");
  });

  it("uses a learning step when direct evidence is still missing", () => {
    const state = topicState();
    const path = getLearningPath(state, "waves", "2026-09-02");
    expect(path).toMatchObject({
      status: "needs_evidence",
      steps: [{ topicId: "waves", action: "learn", route: "/study" }],
    });
  });

  it("adds a verification step for a ready topic without weak prerequisites", () => {
    const state = topicState();
    state.learningEvidence = [
      {
        id: "e1",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 92,
        recordedAt: "2026-09-01",
      },
      {
        id: "e2",
        topicId: "waves",
        subject: "Physics",
        kind: "practice",
        score: 90,
        recordedAt: "2026-09-01",
      },
    ];
    const path = getLearningPath(state, "waves", "2026-09-02");
    expect(path?.status).toBe("ready");
    expect(path?.steps.at(-1)).toMatchObject({
      kind: "verification",
      action: "verify",
      route: "/quizzes",
    });
  });

  it("does not recurse forever on a prerequisite cycle", () => {
    const state = topicState();
    state.topics = [
      {
        id: "a",
        subject: "Physics",
        name: "A",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["b"],
      },
      {
        id: "b",
        subject: "Physics",
        name: "B",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["a"],
      },
    ];
    const path = getLearningPath(state, "a", "2026-09-02");
    expect(path?.steps.map(step => step.topicId)).toEqual(["b", "a"]);
  });
});

describe("B38 mastery reassessment", () => {
  it("recomputes mastery from fresh evidence without mutating the workspace", () => {
    const state = topicState();
    state.learningEvidence = [
      {
        id: "old",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 40,
        recordedAt: "2026-08-30",
      },
    ];
    const before = state.learningEvidence.length;
    const reassessment = reassessTopicMastery(
      state,
      "waves",
      [
        {
          id: "new",
          topicId: "waves",
          subject: "Physics",
          kind: "quiz",
          score: 92,
          recordedAt: "2026-09-02",
        },
        {
          id: "practice",
          topicId: "waves",
          subject: "Physics",
          kind: "practice",
          score: 88,
          recordedAt: "2026-09-02",
        },
      ],
      "2026-09-02"
    );
    expect(reassessment?.outcome).toBe("improved");
    expect(reassessment?.newDirectEvidenceCount).toBe(2);
    expect(reassessment?.current.readiness).toBeGreaterThan(
      reassessment?.previous.readiness ?? 0
    );
    expect(state.learningEvidence).toHaveLength(before);
  });

  it("does not invent progress when no new evidence arrives", () => {
    const state = topicState();
    const reassessment = reassessTopicMastery(state, "waves", [], "2026-09-02");
    expect(reassessment?.outcome).toBe("no_new_evidence");
    expect(reassessment?.scoreDelta).toBe(0);
  });

  it("closes a path only after prerequisite and target signals are reliable", () => {
    const state = topicState();
    state.topics = [
      {
        id: "motion",
        subject: "Physics",
        name: "Motion",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["algebra"],
      },
      {
        id: "algebra",
        subject: "Physics",
        name: "Algebra",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    state.learningEvidence = [
      {
        id: "a1",
        topicId: "algebra",
        subject: "Physics",
        kind: "quiz",
        score: 42,
        recordedAt: "2026-09-01",
      },
    ];
    const path = getLearningPath(state, "motion", "2026-09-02")!;
    const result = reassessLearningPath(
      state,
      path,
      [
        {
          id: "a2",
          topicId: "algebra",
          subject: "Physics",
          kind: "quiz",
          score: 90,
          recordedAt: "2026-09-02",
        },
        {
          id: "m1",
          topicId: "motion",
          subject: "Physics",
          kind: "quiz",
          score: 91,
          recordedAt: "2026-09-02",
        },
        {
          id: "m2",
          topicId: "motion",
          subject: "Physics",
          kind: "practice",
          score: 89,
          recordedAt: "2026-09-02",
        },
      ],
      "2026-09-02"
    );
    expect(result?.complete).toBe(false);
    const verified = reassessLearningPath(
      state,
      path,
      [
        {
          id: "a2",
          topicId: "algebra",
          subject: "Physics",
          kind: "quiz",
          score: 90,
          recordedAt: "2026-09-02",
        },
        {
          id: "a3",
          topicId: "algebra",
          subject: "Physics",
          kind: "practice",
          score: 92,
          recordedAt: "2026-09-02",
        },
        {
          id: "a4",
          topicId: "algebra",
          subject: "Physics",
          kind: "quiz",
          sourceId: "varied-a4",
          score: 94,
          recordedAt: "2026-09-02",
        },
        {
          id: "m1",
          topicId: "motion",
          subject: "Physics",
          kind: "quiz",
          score: 91,
          recordedAt: "2026-09-02",
        },
        {
          id: "m2",
          topicId: "motion",
          subject: "Physics",
          kind: "practice",
          score: 89,
          recordedAt: "2026-09-02",
        },
      ],
      "2026-09-02"
    );
    expect(verified?.complete).toBe(true);
    expect(verified?.stepsCompleted).toBe(verified?.stepsTotal);
    expect(result?.reassessment.outcome).toBe("improved");
  });
});
