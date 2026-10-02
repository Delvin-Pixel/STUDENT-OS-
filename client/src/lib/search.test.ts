import { describe, expect, it } from "vitest";
import { getGlobalSearchResults } from "./search";
import { emptyState } from "./storage";

describe("getGlobalSearchResults", () => {
  it("finds records across workspace types and ignores blank queries", () => {
    const state = emptyState();
    state.tasks.push({
      id: "task-1",
      title: "Complete algebra practice",
      description: "",
      subject: "Mathematics",
      dueDate: "2026-08-13",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-13",
    });
    state.notes.push({
      id: "note-1",
      title: "Algebra formulas",
      subject: "Mathematics",
      content: "",
      pinned: false,
      createdAt: "2026-08-13",
      updatedAt: "2026-08-13",
    });

    expect(getGlobalSearchResults(state, "algebra")).toEqual([
      expect.objectContaining({
        kind: "Note",
        route: "/notes?noteId=note-1",
        title: "Algebra formulas",
      }),
      expect.objectContaining({
        kind: "Task",
        route: "/tasks?taskId=task-1",
        title: "Complete algebra practice",
      }),
    ]);
    expect(getGlobalSearchResults(state, "   ")).toEqual([]);
  });

  it("ranks title matches above subject-only matches and indexes saved lessons", () => {
    const state = emptyState();
    state.tasks.push({
      id: "task",
      title: "Chemistry revision",
      description: "",
      subject: "General",
      dueDate: "",
      priority: "medium",
      status: "todo",
      createdAt: "",
    });
    state.savedLessons.push({
      id: "saved",
      title: "Organic chemistry",
      subject: "Chemistry",
      topic: "Bonding",
      savedAt: "2026-08-22",
      selectionKey: "2026-08-22:chemistry",
      dateStr: "2026-08-22",
      branch: "Organic",
      strapline: "Bonding",
      learningGoals: [],
      recap: "",
    });
    const results = getGlobalSearchResults(state, "chemistry");
    expect(results[0]).toMatchObject({
      kind: "Task",
      route: "/tasks?taskId=task",
    });
    expect(results[1]).toMatchObject({
      kind: "Saved lesson",
      route: "/saved?lessonId=saved",
    });
  });

  it("finds connected materials and practice records from the same search surface", () => {
    const state = emptyState();
    state.studyMaterials.push({
      id: "material",
      title: "Chemical bonding pack",
      subject: "Chemistry",
      fileName: "bonding.pdf",
      mimeType: "application/pdf",
      storageKey: "private/bonding.pdf",
      url: "/storage/private/bonding.pdf",
      sizeBytes: 20,
      addedAt: "2026-08-22",
    });
    state.quizzes.push({
      id: "quiz",
      title: "Chemical bonding check",
      subject: "Chemistry",
      topic: "Bonding",
      source: "manual",
      createdAt: "2026-08-22",
      questions: [],
    });
    const results = getGlobalSearchResults(state, "bonding");
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "Study material",
          route: "/materials?materialId=material",
        }),
        expect.objectContaining({
          kind: "Quiz",
          route: "/quizzes?quizId=quiz",
        }),
      ])
    );
  });
});
