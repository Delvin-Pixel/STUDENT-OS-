import { describe, expect, it } from "vitest";
import {
  addStudyNote,
  createStudyNote,
  removeStudyNote,
  updateStudyNote,
} from "./notes";
import { emptyState } from "./storage";

describe("study note helpers", () => {
  it("creates and adds a note without mutating the prior state", () => {
    const initial = emptyState();
    const note = createStudyNote(
      {
        title: "Forces",
        subject: "Science",
        content: "Resultant force",
        pinned: false,
      },
      "note-1",
      "2026-08-12T10:00:00.000Z"
    );
    const result = addStudyNote(initial, note);

    expect(initial.notes).toHaveLength(0);
    expect(result.notes).toEqual([note]);
  });

  it("updates the selected note and keeps the rest unchanged", () => {
    const first = createStudyNote(
      { title: "Forces", subject: "Science", content: "A", pinned: false },
      "note-1",
      "2026-08-12T10:00:00.000Z"
    );
    const second = createStudyNote(
      { title: "Algebra", subject: "Mathematics", content: "B", pinned: false },
      "note-2",
      "2026-08-12T10:00:00.000Z"
    );
    const updated = updateStudyNote(
      addStudyNote(addStudyNote(emptyState(), first), second),
      "note-1",
      { pinned: true, content: "Expanded" },
      "2026-08-12T11:00:00.000Z"
    );

    expect(updated.notes.find(note => note.id === "note-1")).toMatchObject({
      pinned: true,
      content: "Expanded",
      updatedAt: "2026-08-12T11:00:00.000Z",
    });
    expect(updated.notes.find(note => note.id === "note-2")).toEqual(second);
  });

  it("removes only the chosen note", () => {
    const first = createStudyNote(
      { title: "One", subject: "General", content: "A", pinned: false },
      "note-1",
      "2026-08-12T10:00:00.000Z"
    );
    const second = createStudyNote(
      { title: "Two", subject: "General", content: "B", pinned: false },
      "note-2",
      "2026-08-12T10:00:00.000Z"
    );
    const result = removeStudyNote(
      addStudyNote(addStudyNote(emptyState(), first), second),
      "note-1"
    );

    expect(result.notes).toEqual([second]);
  });
});
