import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import {
  appendRemovedNestedSyncTombstones,
  appendRemovedSyncTombstones,
  appendSyncTombstones,
} from "./workspaceTombstones";

describe("workspace deletion tombstones", () => {
  it("deduplicates repeated deletion attempts using the latest timestamp", () => {
    const once = appendSyncTombstones(
      emptyState(),
      "tasks",
      ["task-1"],
      "2026-08-22T10:00:00.000Z"
    );
    const twice = appendSyncTombstones(
      once,
      "tasks",
      ["task-1"],
      "2026-08-23T10:00:00.000Z"
    );
    expect(twice.syncTombstones).toEqual([
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-08-23T10:00:00.000Z",
      },
    ]);
  });

  it("marks bounded-history eviction as a deletion rather than allowing it to reappear in a merge", () => {
    const state = emptyState();
    const before = [{ id: "old" }, { id: "recent" }];
    const next = appendRemovedSyncTombstones(
      state,
      "notifications",
      before,
      [{ id: "recent" }],
      entry => entry.id,
      "2026-08-23T10:00:00.000Z"
    );
    expect(next.syncTombstones).toEqual([
      {
        collection: "notifications",
        id: "old",
        deletedAt: "2026-08-23T10:00:00.000Z",
      },
    ]);
  });

  it("records nested plan-item and exam-topic removals once at the canonical mutation boundary", () => {
    const before = emptyState();
    before.studyPlans = [
      {
        id: "plan-1",
        title: "Plan",
        startDate: "2026-08-25",
        endDate: "2026-08-25",
        availableMinutesPerDay: 60,
        createdAt: "2026-08-25",
        updatedAt: "2026-08-25",
        items: [
          {
            id: "plan-item-1",
            subject: "Maths",
            topic: "Algebra",
            date: "2026-08-25",
            startTime: "09:00",
            duration: 30,
            priority: "medium",
            reason: "Revision",
            status: "planned",
            createdAt: "2026-08-25",
          },
        ],
      },
    ];
    before.exams = [
      {
        id: "exam-1",
        subject: "Maths",
        name: "Final",
        date: "2026-08-30",
        time: "09:00",
        location: "Hall",
        notes: "",
        topics: [{ id: "exam-topic-1", name: "Algebra", status: "learning" }],
      },
    ];
    const after = {
      ...before,
      studyPlans: [{ ...before.studyPlans[0]!, items: [] }],
      exams: [{ ...before.exams[0]!, topics: [] }],
    };

    const once = appendRemovedNestedSyncTombstones(
      before,
      after,
      "2026-08-25T12:00:00.000Z"
    );
    const twice = appendRemovedNestedSyncTombstones(
      after,
      once,
      "2026-08-25T12:01:00.000Z"
    );

    expect(once.syncTombstones).toEqual(
      expect.arrayContaining([
        {
          collection: "studyPlanItems",
          id: "plan-item-1",
          deletedAt: "2026-08-25T12:00:00.000Z",
        },
        {
          collection: "examTopics",
          id: "exam-topic-1",
          deletedAt: "2026-08-25T12:00:00.000Z",
        },
      ])
    );
    expect(twice.syncTombstones).toEqual(once.syncTombstones);
  });
});

it("fails closed when the deletion ledger is at capacity", async () => {
  const state = emptyState();
  state.syncTombstones = Array.from({ length: 20_000 }, (_, index) => ({
    collection: "tasks" as const,
    id: `task-${index}`,
    deletedAt: "2026-08-25T12:00:00.000Z",
  }));
  expect(() =>
    appendSyncTombstones(
      state,
      "tasks",
      ["new-delete"],
      "2026-08-26T12:00:00.000Z"
    )
  ).toThrow("cannot safely record another deletion");
  expect(state.syncTombstones).not.toContainEqual(
    expect.objectContaining({ id: "new-delete" })
  );
});
