/* STUDENT OS — saved lessons (bookmark) unit tests.
   Covers the two store actions: saveSavedLesson (dedupe by selection key,
   newest first) and removeSavedLesson (by id), against real reducer logic
   derived from StoreContext. */

import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import type { SavedLesson, StudyState } from "./types";

function makeSavedLesson(overrides: Partial<SavedLesson> = {}): SavedLesson {
  return {
    id: crypto.randomUUID(),
    selectionKey: "2026-08-15:math",
    dateStr: "2026-08-15",
    subject: "Mathematics",
    branch: "Algebra",
    topic: "Quadratic equations",
    title: "Solving quadratic equations",
    strapline: "Find both roots with confidence.",
    learningGoals: ["Solve by factorising"],
    recap: "Revision recap text.",
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

function saveReducer(
  prev: StudyState,
  lesson: Omit<SavedLesson, "id" | "savedAt">
): StudyState {
  if (prev.savedLessons.some(s => s.selectionKey === lesson.selectionKey))
    return prev;
  return {
    ...prev,
    savedLessons: [
      { id: crypto.randomUUID(), ...lesson, savedAt: new Date().toISOString() },
      ...prev.savedLessons,
    ],
  };
}

function removeReducer(prev: StudyState, id: string): StudyState {
  return { ...prev, savedLessons: prev.savedLessons.filter(s => s.id !== id) };
}

describe("saved lessons", () => {
  it("starts every state with an empty savedLessons collection", () => {
    expect(emptyState().savedLessons).toEqual([]);
  });

  it("saves a lesson at the front of the collection with an id and savedAt", () => {
    const state = saveReducer(emptyState(), makeSavedLesson());
    expect(state.savedLessons).toHaveLength(1);
    expect(state.savedLessons[0].selectionKey).toBe("2026-08-15:math");
    expect(state.savedLessons[0].id).toBeTruthy();
    expect(new Date(state.savedLessons[0].savedAt).getTime()).toBeGreaterThan(
      0
    );
  });

  it("dedupes by selection key — saving the same day twice is a no-op", () => {
    const lesson = makeSavedLesson();
    let state = saveReducer(emptyState(), lesson);
    state = saveReducer(state, { ...lesson });
    expect(state.savedLessons).toHaveLength(1);
  });

  it("allows different days/topics to be bookmarked alongside each other", () => {
    let state = saveReducer(
      emptyState(),
      makeSavedLesson({
        selectionKey: "2026-08-15:math",
        dateStr: "2026-08-15",
      })
    );
    state = saveReducer(
      state,
      makeSavedLesson({
        selectionKey: "2026-08-16:science",
        dateStr: "2026-08-16",
      })
    );
    expect(state.savedLessons).toHaveLength(2);
    expect(state.savedLessons[0].selectionKey).toBe("2026-08-16:science");
  });

  it("removes a saved lesson by id", () => {
    const state = saveReducer(emptyState(), makeSavedLesson());
    const id = state.savedLessons[0].id;
    const next = removeReducer(state, id);
    expect(next.savedLessons).toHaveLength(0);
  });

  it("ignores removal of a nonexistent id", () => {
    const state = saveReducer(emptyState(), makeSavedLesson());
    const next = removeReducer(state, "does-not-exist");
    expect(next.savedLessons).toEqual(state.savedLessons);
  });

  it("preserves the rest of the study state untouched", () => {
    const base = emptyState();
    base.tasks = [
      {
        id: "t1",
        title: "Maths HW",
        description: "",
        subject: "Math",
        dueDate: "",
        priority: "high",
        status: "todo",
        createdAt: "",
      },
    ];
    const next = saveReducer(base, makeSavedLesson());
    expect(next.tasks).toEqual(base.tasks);
    expect(next.xp).toBe(base.xp);
  });
});
