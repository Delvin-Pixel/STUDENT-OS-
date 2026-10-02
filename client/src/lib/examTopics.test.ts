import { describe, expect, it } from "vitest";
import { detachExamTopic, removeExamPreservingTopics } from "./examTopics";
import { emptyState } from "./storage";

function stateWithExamTopic() {
  const state = emptyState();
  state.exams = [
    {
      id: "exam-a",
      subject: "Physics",
      name: "Mock",
      date: "2026-08-28",
      time: "",
      location: "",
      notes: "",
      topics: [{ id: "waves", name: "Waves", status: "learning" }],
    },
  ];
  return state;
}

describe("exam topic detachment", () => {
  it("promotes a detached exam topic when existing learning evidence would otherwise be orphaned", () => {
    const state = stateWithExamTopic();
    state.learningEvidence = [
      {
        id: "evidence",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 82,
        recordedAt: "2026-08-22",
      },
    ];

    const result = detachExamTopic(
      state,
      "exam-a",
      "waves",
      "2026-08-24T00:00:00.000Z"
    );

    expect(result.exams[0]?.topics).toEqual([]);
    expect(result.topics).toEqual([
      {
        id: "waves",
        subject: "Physics",
        name: "Waves",
        source: "exam",
        createdAt: "2026-08-24T00:00:00.000Z",
        updatedAt: "2026-08-24T00:00:00.000Z",
      },
    ]);
  });

  it("does not duplicate a topic still retained by another exam", () => {
    const state = stateWithExamTopic();
    state.exams.push({
      id: "exam-b",
      subject: "Physics",
      name: "Final",
      date: "2026-09-05",
      time: "",
      location: "",
      notes: "",
      topics: [{ id: "waves", name: "Waves", status: "not_started" }],
    });
    state.sessions = [
      {
        id: "session",
        subject: "Physics",
        topic: "Waves",
        topicId: "waves",
        date: "2026-08-24",
        startTime: "18:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
    ];

    const result = detachExamTopic(
      state,
      "exam-a",
      "waves",
      "2026-08-24T00:00:00.000Z"
    );

    expect(result.exams[0]?.topics).toEqual([]);
    expect(result.exams[1]?.topics).toHaveLength(1);
    expect(result.topics).toEqual([]);
  });

  it("removes an unlinked topic without creating a redundant canonical record", () => {
    const result = detachExamTopic(
      stateWithExamTopic(),
      "exam-a",
      "waves",
      "2026-08-24T00:00:00.000Z"
    );

    expect(result.exams[0]?.topics).toEqual([]);
    expect(result.topics).toEqual([]);
  });

  it("retains linked topic identities while deleting the whole exam", () => {
    const state = stateWithExamTopic();
    state.notes = [
      {
        id: "note",
        title: "Wave notes",
        subject: "Physics",
        topicId: "waves",
        content: "Refraction",
        pinned: false,
        createdAt: "2026-08-22",
        updatedAt: "2026-08-22",
      },
    ];

    const result = removeExamPreservingTopics(
      state,
      "exam-a",
      "2026-08-24T00:00:00.000Z"
    );

    expect(result.exams).toEqual([]);
    expect(result.topics).toMatchObject([
      { id: "waves", subject: "Physics", name: "Waves", source: "exam" },
    ]);
    expect(result.notes[0]?.topicId).toBe("waves");
  });
});
