import { describe, expect, it } from "vitest";
import { validateStudyState } from "../../../shared/workspaceSchema";
import { emptyState } from "./storage";
import type { StudyState } from "./types";
import { mergeWorkspaceStates } from "./workspaceMerge";

function planWithItems(
  id: string,
  items: Array<{ id: string; topic: string }>
): StudyState["studyPlans"][number] {
  return {
    id,
    title: "Revision plan",
    startDate: "2026-08-24",
    endDate: "2026-08-30",
    availableMinutesPerDay: 60,
    createdAt: "2026-08-24T08:00:00.000Z",
    updatedAt: "2026-08-24T08:00:00.000Z",
    items: items.map(item => ({
      id: item.id,
      subject: "Maths",
      topic: item.topic,
      date: "2026-08-25",
      startTime: "09:00",
      duration: 30,
      priority: "medium",
      reason: "Revision",
      status: "planned",
      createdAt: "2026-08-24T08:00:00.000Z",
    })),
  };
}

function examWithTopics(
  id: string,
  topics: Array<{
    id: string;
    name: string;
    status: StudyState["exams"][number]["topics"][number]["status"];
  }>
): StudyState["exams"][number] {
  return {
    id,
    subject: "Maths",
    name: "Final",
    date: "2026-09-01",
    time: "09:00",
    location: "Hall",
    notes: "",
    topics,
  };
}

describe("workspace conflict merging", () => {
  it("preserves independent task additions from cloud and local devices", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.tasks.push({
      id: "cloud-task",
      title: "Cloud task",
      description: "",
      subject: "Math",
      dueDate: "",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-22",
    });
    local.tasks.push({
      id: "local-task",
      title: "Local task",
      description: "",
      subject: "Science",
      dueDate: "",
      priority: "high",
      status: "todo",
      createdAt: "2026-08-22",
    });
    expect(
      mergeWorkspaceStates(cloud, local).tasks.map(task => task.id)
    ).toEqual(expect.arrayContaining(["cloud-task", "local-task"]));
  });

  it("keeps the active device version when both devices edited the same record", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.notes.push({
      id: "note-1",
      title: "Cloud title",
      subject: "Biology",
      content: "cloud",
      pinned: false,
      createdAt: "2026-08-22",
      updatedAt: "2026-08-22",
    });
    local.notes.push({
      id: "note-1",
      title: "Local title",
      subject: "Biology",
      content: "local",
      pinned: true,
      createdAt: "2026-08-22",
      updatedAt: "2026-08-22T12:00:00.000Z",
    });
    expect(mergeWorkspaceStates(cloud, local).notes[0]).toMatchObject({
      title: "Local title",
      content: "local",
      pinned: true,
    });
  });

  it("keeps a local deletion over an offline cloud edit of the same task", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.tasks.push({
      id: "task-1",
      title: "Edited elsewhere",
      description: "",
      subject: "Math",
      dueDate: "",
      priority: "high",
      status: "in_progress",
      createdAt: "2026-08-22",
    });
    local.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-08-23T00:00:00.000Z",
    });
    const merged = mergeWorkspaceStates(cloud, local);
    expect(merged.tasks).toEqual([]);
    expect(merged.syncTombstones).toEqual(local.syncTombstones);
  });

  it("is deterministic and idempotent when both peers deleted the same record", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.tasks.push({
      id: "task-1",
      title: "Old",
      description: "",
      subject: "Math",
      dueDate: "",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-22",
    });
    cloud.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-08-22T11:00:00.000Z",
    });
    local.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-08-23T11:00:00.000Z",
    });
    const once = mergeWorkspaceStates(cloud, local);
    const twice = mergeWorkspaceStates(once, local);
    expect(once.tasks).toEqual([]);
    expect(once).toEqual(twice);
    expect(once.syncTombstones).toEqual([
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-08-23T11:00:00.000Z",
      },
    ]);
  });

  it("makes deletion win over a stale same-id re-creation and still preserves unrelated additions", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.tasks.push({
      id: "task-1",
      title: "Stale re-created task",
      description: "",
      subject: "Math",
      dueDate: "",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-22",
    });
    local.tasks.push({
      id: "task-2",
      title: "Independent addition",
      description: "",
      subject: "Science",
      dueDate: "",
      priority: "low",
      status: "todo",
      createdAt: "2026-08-23",
    });
    local.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-08-23T11:00:00.000Z",
    });
    expect(
      mergeWorkspaceStates(cloud, local).tasks.map(task => task.id)
    ).toEqual(["task-2"]);
  });

  it("prevents an offline peer from resurrecting a removed nested flashcard", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.decks.push({
      id: "deck-1",
      name: "Biology",
      subject: "Biology",
      createdAt: "2026-08-22",
      cards: [
        {
          id: "card-1",
          front: "Cloud edit",
          back: "Still stale",
          status: "new",
        },
      ],
    });
    local.decks.push({
      id: "deck-1",
      name: "Biology",
      subject: "Biology",
      createdAt: "2026-08-22",
      cards: [
        { id: "card-2", front: "New", back: "Independent", status: "new" },
      ],
    });
    local.syncTombstones.push({
      collection: "cards",
      id: "card-1",
      deletedAt: "2026-08-23T11:00:00.000Z",
    });
    const merged = mergeWorkspaceStates(cloud, local);
    expect(merged.decks[0].cards.map(card => card.id)).toEqual(["card-2"]);
  });

  it("unions independent same-day habit completions deterministically without restoring a deleted habit", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.habitLog = { "2026-08-24": ["cloud-habit", "deleted-habit"] };
    local.habitLog = { "2026-08-24": ["local-habit", "cloud-habit"] };
    local.syncTombstones.push({
      collection: "habits",
      id: "deleted-habit",
      deletedAt: "2026-08-24T12:00:00.000Z",
    });

    const once = mergeWorkspaceStates(cloud, local);
    const twice = mergeWorkspaceStates(once, local);

    expect(once.habitLog).toEqual({
      "2026-08-24": ["cloud-habit", "local-habit"],
    });
    expect(once).toEqual(twice);
  });

  it("preserves independent nested plan-item additions while retaining the active device version of a same item", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.studyPlans.push(
      planWithItems("plan-1", [
        { id: "cloud-item", topic: "Vectors" },
        { id: "shared-item", topic: "Cloud wording" },
      ])
    );
    local.studyPlans.push(
      planWithItems("plan-1", [
        { id: "local-item", topic: "Matrices" },
        { id: "shared-item", topic: "Local wording" },
      ])
    );

    const once = mergeWorkspaceStates(cloud, local);
    const twice = mergeWorkspaceStates(once, local);

    expect(once.studyPlans[0].items.map(item => item.id)).toEqual([
      "cloud-item",
      "shared-item",
      "local-item",
    ]);
    expect(
      once.studyPlans[0].items.find(item => item.id === "shared-item")?.topic
    ).toBe("Local wording");
    expect(once).toEqual(twice);
  });

  it("preserves independent nested exam-topic changes while retaining the active device version of a same topic", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.exams.push(
      examWithTopics("exam-1", [
        { id: "cloud-topic", name: "Algebra", status: "learning" },
        { id: "shared-topic", name: "Cloud wording", status: "revised" },
      ])
    );
    local.exams.push(
      examWithTopics("exam-1", [
        { id: "local-topic", name: "Geometry", status: "not_started" },
        { id: "shared-topic", name: "Local wording", status: "mastered" },
      ])
    );

    const once = mergeWorkspaceStates(cloud, local);
    const twice = mergeWorkspaceStates(once, local);

    expect(once.exams[0].topics.map(topic => topic.id)).toEqual([
      "cloud-topic",
      "shared-topic",
      "local-topic",
    ]);
    expect(
      once.exams[0].topics.find(topic => topic.id === "shared-topic")?.status
    ).toBe("mastered");
    expect(once).toEqual(twice);
  });

  it("keeps an offline study-plan-item deletion authoritative over a stale peer edit while preserving unrelated additions and edits", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.studyPlans.push(
      planWithItems("plan-1", [
        { id: "deleted-item", topic: "Stale cloud edit" },
        { id: "shared-item", topic: "Cloud wording" },
      ])
    );
    local.studyPlans.push(
      planWithItems("plan-1", [
        { id: "shared-item", topic: "Local revision" },
        { id: "new-item", topic: "Independent addition" },
      ])
    );
    local.syncTombstones.push({
      collection: "studyPlanItems",
      id: "deleted-item",
      deletedAt: "2026-08-25T10:00:00.000Z",
    });

    const once = mergeWorkspaceStates(cloud, local);
    const twice = mergeWorkspaceStates(once, local);
    const hydrated = JSON.parse(JSON.stringify(once));

    expect(once.studyPlans[0]?.items.map(item => item.id)).toEqual([
      "shared-item",
      "new-item",
    ]);
    expect(
      once.studyPlans[0]?.items.find(item => item.id === "shared-item")?.topic
    ).toBe("Local revision");
    expect(once).toEqual(twice);
    expect(validateStudyState(hydrated).success).toBe(true);
    expect(
      (hydrated as StudyState).studyPlans[0]?.items.map(item => item.id)
    ).toEqual(["shared-item", "new-item"]);
  });

  it("keeps a server study-plan-item tombstone authoritative over a stale local copy", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.studyPlans.push(
      planWithItems("plan-1", [
        { id: "retained-item", topic: "Current server item" },
      ])
    );
    cloud.syncTombstones.push({
      collection: "studyPlanItems",
      id: "deleted-item",
      deletedAt: "2026-08-25T10:00:00.000Z",
    });
    local.studyPlans.push(
      planWithItems("plan-1", [
        { id: "deleted-item", topic: "Stale local copy" },
        { id: "retained-item", topic: "Stale local edit" },
      ])
    );

    const merged = mergeWorkspaceStates(cloud, local);

    expect(merged.studyPlans[0]?.items.map(item => item.id)).toEqual([
      "retained-item",
    ]);
    expect(merged.studyPlans[0]?.items[0]?.topic).toBe("Stale local edit");
  });

  it("keeps an offline exam-topic deletion authoritative over a stale peer edit while preserving unrelated additions and edits", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.exams.push(
      examWithTopics("exam-1", [
        { id: "deleted-topic", name: "Stale cloud edit", status: "learning" },
        { id: "shared-topic", name: "Cloud wording", status: "revised" },
      ])
    );
    local.exams.push(
      examWithTopics("exam-1", [
        { id: "shared-topic", name: "Local revision", status: "mastered" },
        {
          id: "new-topic",
          name: "Independent addition",
          status: "not_started",
        },
      ])
    );
    local.syncTombstones.push({
      collection: "examTopics",
      id: "deleted-topic",
      deletedAt: "2026-08-25T10:00:00.000Z",
    });

    const once = mergeWorkspaceStates(cloud, local);
    const twice = mergeWorkspaceStates(once, local);
    const hydrated = JSON.parse(JSON.stringify(once));

    expect(once.exams[0]?.topics.map(topic => topic.id)).toEqual([
      "shared-topic",
      "new-topic",
    ]);
    expect(
      once.exams[0]?.topics.find(topic => topic.id === "shared-topic")?.status
    ).toBe("mastered");
    expect(once).toEqual(twice);
    expect(validateStudyState(hydrated).success).toBe(true);
    expect(
      (hydrated as StudyState).exams[0]?.topics.map(topic => topic.id)
    ).toEqual(["shared-topic", "new-topic"]);
  });

  it("keeps a server exam-topic tombstone authoritative over a stale local copy", () => {
    const cloud = emptyState();
    const local = emptyState();
    cloud.exams.push(
      examWithTopics("exam-1", [
        {
          id: "retained-topic",
          name: "Current server topic",
          status: "learning",
        },
      ])
    );
    cloud.syncTombstones.push({
      collection: "examTopics",
      id: "deleted-topic",
      deletedAt: "2026-08-25T10:00:00.000Z",
    });
    local.exams.push(
      examWithTopics("exam-1", [
        { id: "deleted-topic", name: "Stale local copy", status: "revised" },
        { id: "retained-topic", name: "Stale local edit", status: "mastered" },
      ])
    );

    const merged = mergeWorkspaceStates(cloud, local);

    expect(merged.exams[0]?.topics.map(topic => topic.id)).toEqual([
      "retained-topic",
    ]);
    expect(merged.exams[0]?.topics[0]?.status).toBe("mastered");
  });
});
