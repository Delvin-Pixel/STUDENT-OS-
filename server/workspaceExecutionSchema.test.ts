import { describe, expect, it } from "vitest";
import { emptyState } from "../client/src/lib/storage";
import { validateStudyState } from "../shared/workspaceSchema";

describe("workspace execution lifecycle schema", () => {
  it("accepts a legacy workspace with no execution metadata", () => {
    expect(validateStudyState(emptyState()).success).toBe(true);
  });

  it("accepts bounded execution, reflection, skip, and reschedule metadata", () => {
    const state = emptyState();
    state.sessions = [
      {
        id: "session-1",
        subject: "Physics",
        topic: "Waves",
        date: "2026-08-22",
        startTime: "18:00",
        duration: 40,
        difficulty: "hard",
        priority: "high",
        notes: "Exam in 6 days",
        status: "completed",
        startedAt: "2026-08-22T18:00:00.000Z",
        pausedAt: "2026-08-22T18:10:00.000Z",
        resumedAt: "2026-08-22T18:15:00.000Z",
        finishedAt: "2026-08-22T18:45:00.000Z",
        actualDuration: 30,
        reflection: "difficult",
      },
    ];
    state.studyPlans = [
      {
        id: "plan-1",
        title: "Physics",
        startDate: "2026-08-22",
        endDate: "2026-08-23",
        availableMinutesPerDay: 60,
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z",
        items: [
          {
            id: "item-1",
            subject: "Physics",
            topic: "Waves",
            date: "2026-08-23",
            startTime: "18:00",
            duration: 30,
            priority: "high",
            reason: "Weak topic",
            status: "skipped",
            createdAt: "2026-08-22T00:00:00.000Z",
            skipReason: "too_tired",
            rescheduledAt: "2026-08-22T18:00:00.000Z",
          },
        ],
      },
    ];
    expect(validateStudyState(state).success).toBe(true);
  });

  it("accepts optional learner-reviewable answer evidence on a quiz attempt", () => {
    const state = emptyState();
    state.quizAttempts = [
      {
        id: "attempt-1",
        quizId: "quiz-1",
        subject: "Physics",
        score: 50,
        correctCount: 1,
        questionCount: 2,
        completedAt: "2026-08-23T00:00:00.000Z",
        responses: [
          {
            questionId: "question-1",
            prompt: "What is frequency?",
            selectedOptionIndex: 1,
            correctOptionIndex: 0,
            correct: false,
            explanation: "Frequency is cycles per second.",
          },
        ],
      },
    ];
    expect(validateStudyState(state).success).toBe(true);
  });

  it("accepts action-specific consent for material-derived practice-question drafts without requiring it in legacy workspaces", () => {
    const state = emptyState();
    state.studyMaterials = [
      {
        id: "material-1",
        title: "Waves",
        subject: "Physics",
        fileName: "waves.pdf",
        mimeType: "application/pdf",
        storageKey: "account/study-materials/waves.pdf",
        url: "/storage/account/study-materials/waves.pdf",
        sizeBytes: 1200,
        addedAt: "2026-08-23T00:00:00.000Z",
        aiPracticeQuestionConsentAt: "2026-08-23T00:01:00.000Z",
      },
    ];
    expect(validateStudyState(state).success).toBe(true);
  });
});
