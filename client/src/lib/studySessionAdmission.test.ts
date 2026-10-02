import type { StudySession } from "@/lib/types";
import { WORKSPACE_STUDY_SESSION_LIMIT } from "@shared/workspaceSchema";
import { describe, expect, it } from "vitest";
import { admitPlannedStudySession } from "./studySessionAdmission";

const activationDraft = {
  subject: "Physics",
  topic: "Forces",
  topicId: "removed-topic",
  date: "2026-09-01",
  startTime: "16:00",
  duration: 45,
  difficulty: "medium" as const,
  priority: "high" as const,
  notes: "Revision plan item",
  status: "planned" as const,
};

describe("canonical planned study-session admission", () => {
  it("rejects a removed plan-item topic before an activation payload can be admitted", () => {
    const admission = admitPlannedStudySession(
      { sessions: [], topics: [], exams: [], events: [] },
      activationDraft,
      { planId: "plan-1", planItemId: "item-1" }
    );

    expect(admission).toEqual({ accepted: false, reason: "stale_topic" });
  });

  it("rejects a plan-item activation at the 5,000-session workspace boundary before an activation payload can be admitted", () => {
    const admission = admitPlannedStudySession(
      {
        sessions: Array.from(
          { length: WORKSPACE_STUDY_SESSION_LIMIT },
          () => ({}) as StudySession
        ),
        topics: [
          {
            id: "removed-topic",
            subject: "Physics",
            name: "Forces",
            source: "manual",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        exams: [],
        events: [],
      },
      activationDraft,
      { planId: "plan-1", planItemId: "item-1" }
    );

    expect(admission).toEqual({ accepted: false, reason: "capacity" });
  });

  it("admits a current plan-item topic only with a preserved canonical plan link", () => {
    const admission = admitPlannedStudySession(
      {
        sessions: [],
        topics: [
          {
            id: "removed-topic",
            subject: "Physics",
            name: "Forces",
            source: "manual",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        exams: [],
        events: [],
      },
      activationDraft,
      { planId: "plan-1", planItemId: "item-1" }
    );

    expect(admission).toEqual(expect.objectContaining({ accepted: true }));
    if (admission.accepted) expect(admission.session.subject).toBe("Physics");
  });
});
