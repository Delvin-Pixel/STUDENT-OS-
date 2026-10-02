import { describe, expect, it } from "vitest";
import { emptyState } from "../client/src/lib/storage";
import { validateStudyStateSemantics } from "./workspaceSchema";

describe("workspace tombstone integrity", () => {
  it("rejects duplicate tombstones for the same stable record", () => {
    const state = emptyState();
    state.syncTombstones = [
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-08-31T10:00:00.000Z",
      },
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-08-31T11:00:00.000Z",
      },
    ];
    expect(validateStudyStateSemantics(state)).toMatchObject({
      success: false,
      reason: "workspace contains duplicate tombstone tasks:task-1",
    });
  });

  it("rejects a live record that coexists with its tombstone", () => {
    const state = emptyState();
    state.tasks.push({
      id: "task-1",
      title: "Stale task",
      description: "",
      subject: "Math",
      dueDate: "",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-31",
    });
    state.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-08-31T10:00:00.000Z",
    });
    expect(validateStudyStateSemantics(state)).toMatchObject({
      success: false,
      reason: "workspace contains live tasks record task-1 with a tombstone",
    });
  });

  it("rejects invalid non-ISO tombstone timestamps", () => {
    const state = emptyState();
    state.syncTombstones.push({
      collection: "notes",
      id: "note-1",
      deletedAt: "not-a-timestamp",
    });
    expect(validateStudyStateSemantics(state)).toMatchObject({
      success: false,
      reason: expect.stringContaining("has an invalid timestamp"),
    });
  });

  it("rejects resurrected nested records as well", () => {
    const state = emptyState();
    state.decks.push({
      id: "deck-1",
      name: "Physics",
      subject: "Physics",
      createdAt: "2026-08-31",
      cards: [
        { id: "card-1", front: "Current", back: "Answer", status: "new" },
      ],
    });
    state.syncTombstones.push({
      collection: "cards",
      id: "card-1",
      deletedAt: "2026-08-31T10:00:00.000Z",
    });
    expect(validateStudyStateSemantics(state)).toMatchObject({
      success: false,
      reason: "workspace contains live cards record card-1 with a tombstone",
    });
  });
});
