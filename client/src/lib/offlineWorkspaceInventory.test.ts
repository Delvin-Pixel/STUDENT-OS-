import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import {
  buildOfflineWorkspaceInventory,
  preflightCanonicalOfflineWorkspaceSync,
} from "./offlineWorkspaceInventory";
import type { StudyState } from "./types";

function workspace(level: "JHS" | "SHS" | "Tertiary" = "SHS") {
  const state = emptyState();
  state.profile = {
    name: "Sample learner",
    studentType: level === "Tertiary" ? "University" : "Secondary School",
    educationLevel:
      level === "JHS"
        ? "Lower Secondary"
        : level === "SHS"
          ? "Secondary"
          : "Tertiary",
    classLevel:
      level === "JHS" ? "JHS 2" : level === "SHS" ? "SHS 3" : "Level 200",
    goals: [],
    subjects: level === "Tertiary" ? ["Information Technology"] : ["Mathematics"],
    hoursPerDay: "1 hour",
  };
  state.tasks.push({
    id: "task-1",
    title: "Revise algebra",
    subject: "Mathematics",
    description: "",
    dueDate: "",
    priority: "high",
    status: "todo",
    createdAt: "2026-10-26T00:00:00.000Z",
  });
  return state;
}

function nested(): StudyState {
  const state = workspace();
  state.decks.push({
    id: "deck-1",
    name: "Calculus",
    subject: "Mathematics",
    createdAt: "2026-10-26T00:00:00.000Z",
    cards: [
      { id: "card-1", front: "Derivative?", back: "Rate", status: "new" },
    ],
  });
  state.studyPlans.push({
    id: "plan-1",
    title: "Exam preparation",
    startDate: "2026-10-26",
    endDate: "2026-11-26",
    availableMinutesPerDay: 45,
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: "2026-10-26T00:00:00.000Z",
    items: [
      {
        id: "plan-item-1",
        subject: "Mathematics",
        topic: "Algebra",
        date: "2026-10-27",
        startTime: "17:00",
        duration: 30,
        priority: "high",
        reason: "Exam readiness",
        status: "planned",
        createdAt: "2026-10-26T00:00:00.000Z",
      },
    ],
  });
  state.exams.push({
    id: "exam-1",
    subject: "Mathematics",
    name: "Mock exam",
    date: "2026-12-01",
    time: "10:00",
    location: "",
    notes: "",
    topics: [{ id: "exam-topic-1", name: "Algebra", status: "learning" }],
  });
  return state;
}

async function inventory(state: StudyState, revision = 5, account = "owner-1") {
  const result = await buildOfflineWorkspaceInventory(account, state, revision);
  if (result.kind !== "ready") throw Error("Fixture inventory: " + result.kind);
  return result.snapshot;
}

describe("B64.3 canonical workspace inventory", () => {
  it.each(["JHS", "SHS", "Tertiary"] as const)(
    "inventories %s workspaces under one shared deterministic contract",
    async level => {
      const result = await buildOfflineWorkspaceInventory(
        "owner-1",
        workspace(level),
        5
      );
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") return;
      expect(result.snapshot.accountId).toBe("owner-1");
      expect(result.snapshot.records).toHaveLength(1);
      expect(result.snapshot.records[0].collection).toBe("tasks");
      expect(result.snapshot.rootDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  );

  it("sorts equivalent records and object fields deterministically", async () => {
    const state = workspace();
    state.tasks.push({ ...state.tasks[0], id: "task-2", title: "Geometry" });
    const copy = structuredClone(state);
    copy.tasks.reverse();
    copy.tasks[0] = Object.fromEntries(
      Object.entries(copy.tasks[0]).reverse()
    ) as unknown as StudyState["tasks"][number];
    expect(await inventory(state)).toEqual(await inventory(copy));
  });

  it("detects child-card changes without changing the parent-deck digest", async () => {
    const original = await inventory(nested());
    const edited = nested();
    edited.decks[0].cards[0].back = "Change over time";
    const next = await inventory(edited);
    const before = new Map(
      original.records.map(record => [
        record.collection + ":" + record.id,
        JSON.stringify(record),
      ])
    );
    const changed = next.records
      .filter(
        record =>
          JSON.stringify(record) !==
          before.get(record.collection + ":" + record.id)
      )
      .map(record => record.collection + ":" + record.id);
    expect(changed).toEqual(["cards:card-1"]);
    expect(original.records.map(record => record.collection)).toContain(
      "studyPlanItems"
    );
    expect(original.records.map(record => record.collection)).toContain(
      "examTopics"
    );
  });

  it("binds nested items to their parent identity", async () => {
    const source = nested();
    source.decks.push({
      ...source.decks[0],
      id: "deck-2",
      name: "Second deck",
      cards: [],
    });
    const first = await inventory(source);
    const moved = structuredClone(source);
    const card = moved.decks[0].cards.pop();
    if (!card) throw Error("fixture");
    moved.decks[1].cards.push(card);
    const second = await inventory(moved);
    const cardDigest = (records: typeof first.records) =>
      records.find(record => record.collection === "cards")?.digest;
    expect(cardDigest(first)).not.toBe(cardDigest(second));
  });

  it("omits device-private answer ratings from shared conflict snapshots", async () => {
    const source = workspace();
    const base = await inventory(source);
    const other = structuredClone(source);
    other.aiAnswerRatings.push({
      answerId: "a-1",
      surface: "assistant",
      rating: "down",
      answerPreview: "private answer feedback",
      ratedAt: "2026-10-26T00:00:00.000Z",
    });
    expect(await inventory(other)).toEqual(base);
  });

  it("excludes signed URLs, but tracks durable material storage keys", async () => {
    const source = workspace();
    if (!source.profile) throw Error("fixture");
    source.profile.profilePhotoStorageKey = "account/photo";
    source.profile.profilePhotoUrl = "https://signed.example/token-a";
    source.studyMaterials.push({
      id: "material-1",
      title: "Algebra",
      subject: "Mathematics",
      fileName: "lesson.pdf",
      mimeType: "application/pdf",
      storageKey: "account/material.pdf",
      url: "https://signed.example/token-b",
      sizeBytes: 12,
      addedAt: "2026-10-26T00:00:00.000Z",
    });
    const baseline = await inventory(source);
    const changed = structuredClone(source);
    if (!changed.profile) throw Error("fixture");
    changed.profile.profilePhotoUrl = "https://signed.example/token-c";
    changed.studyMaterials[0].url = "https://signed.example/token-d";
    expect(await inventory(changed)).toEqual(baseline);
    changed.studyMaterials[0].storageKey = "account/changed.pdf";
    expect(await inventory(changed)).not.toEqual(baseline);
  });

  it("normalizes daily completion and habit-log set order", async () => {
    const source = workspace();
    source.dailyLessonCompletions = ["day-a", "day-b"];
    source.habitLog = { "2026-10-25": ["habit-1", "habit-2"] };
    const other = structuredClone(source);
    other.dailyLessonCompletions.reverse();
    other.habitLog["2026-10-25"].reverse();
    expect(await inventory(source)).toEqual(await inventory(other));
  });

  it("preserves tombstones and never silently expires deletion", async () => {
    const source = workspace();
    source.tasks = [];
    source.syncTombstones = [
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-10-26T00:00:00.000Z",
      },
    ];
    const result = await inventory(source);
    expect(result.records).toContainEqual({
      collection: "tasks",
      id: "task-1",
      state: "deleted",
    });
    expect(result.records[0]).not.toHaveProperty("digest");
  });

  it("rejects structurally invalid, semantically inconsistent workspaces", async () => {
    expect(
      await buildOfflineWorkspaceInventory("owner-1", { tasks: [] }, 0)
    ).toEqual({ kind: "invalid_workspace" });
    const bad = workspace();
    bad.syncTombstones = [
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-10-26T00:00:00.000Z",
      },
    ];
    expect(await buildOfflineWorkspaceInventory("owner-1", bad, 0)).toEqual({
      kind: "invalid_workspace",
    });
  });

  it("rejects invalid identities and revision numbers", async () => {
    expect(await buildOfflineWorkspaceInventory("", workspace(), 0)).toEqual({
      kind: "invalid_account",
    });
    expect(
      await buildOfflineWorkspaceInventory("owner-1", workspace(), -1)
    ).toEqual({ kind: "invalid_workspace" });
  });

  it("rejects duplicate nested identifiers across separate parents", async () => {
    const source = nested();
    source.decks.push({
      ...source.decks[0],
      id: "deck-2",
      cards: [structuredClone(source.decks[0].cards[0])],
    });
    expect(
      await buildOfflineWorkspaceInventory("owner-1", source, 5)
    ).toEqual({ kind: "unavailable" });
  });

  it("binds identical source content to the originating owner", async () => {
    const source = workspace();
    const a = await inventory(source, 5, "owner-1");
    const b = await inventory(source, 5, "owner-2");
    expect(a.records[0].digest).not.toBe(b.records[0].digest);
    expect(a.rootDigest).not.toBe(b.rootDigest);
  });
});

describe("B64.3 three-way preflight from validated workspace source", () => {
  function request(
    base: StudyState,
    local: StudyState,
    remote: StudyState,
    localRevision = 5,
    remoteRevision = 6
  ) {
    return {
      currentAuthenticatedAccountId: () => "owner-1",
      accountId: "owner-1",
      base: { workspace: base, revision: 5 },
      local: { workspace: local, revision: localRevision },
      remote: { workspace: remote, revision: remoteRevision },
    } as const;
  }

  it("detects concurrent same-task edits and requires review", async () => {
    const base = workspace();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks[0].title = "Local version";
    remote.tasks[0].title = "Remote version";
    expect(
      await preflightCanonicalOfflineWorkspaceSync(request(base, local, remote))
    ).toMatchObject({
      kind: "evaluated",
      decision: {
        kind: "manual_review",
        conflicts: [
          { collection: "tasks", id: "task-1", kind: "same_record_edited" },
        ],
      },
    });
  });

  it("flags delete versus edit instead of reviving a deleted task", async () => {
    const base = workspace();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks = [];
    local.syncTombstones = [
      {
        collection: "tasks",
        id: "task-1",
        deletedAt: "2026-10-26T00:00:00.000Z",
      },
    ];
    remote.tasks[0].title = "Edited remotely";
    expect(
      await preflightCanonicalOfflineWorkspaceSync(request(base, local, remote))
    ).toMatchObject({
      kind: "evaluated",
      decision: {
        kind: "manual_review",
        conflicts: [
          { collection: "tasks", id: "task-1", kind: "delete_versus_edit" },
        ],
      },
    });
  });

  it("requires reviewed rebase when local and remote edits are disjoint", async () => {
    const base = workspace();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks[0].title = "Local revision";
    remote.settings.theme = "dark";
    expect(
      await preflightCanonicalOfflineWorkspaceSync(request(base, local, remote))
    ).toMatchObject({
      kind: "evaluated",
      decision: {
        kind: "rebase_required",
        requiresHumanOrReviewedMerge: true,
      },
    });
  });

  it("ignores private feedback differences between same-account devices", async () => {
    const base = workspace();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.aiAnswerRatings.push({
      answerId: "lesson-1",
      surface: "lesson",
      rating: "up",
      ratedAt: "2026-10-26T00:00:00.000Z",
    });
    expect(
      await preflightCanonicalOfflineWorkspaceSync(request(base, local, remote))
    ).toMatchObject({
      kind: "evaluated",
      decision: { kind: "unchanged", localChanged: false },
    });
  });

  it("blocks local revisions that differ from acknowledged base", async () => {
    const base = workspace();
    expect(
      await preflightCanonicalOfflineWorkspaceSync(
        request(base, structuredClone(base), structuredClone(base), 4)
      )
    ).toMatchObject({
      kind: "evaluated",
      decision: { kind: "blocked", reason: "invalid_revision" },
    });
  });

  it("denies a workspace result when the user changes accounts mid-hash", async () => {
    const source = workspace();
    let checks = 0;
    const result = await preflightCanonicalOfflineWorkspaceSync({
      ...request(source, structuredClone(source), structuredClone(source)),
      currentAuthenticatedAccountId: () =>
        ++checks < 4 ? "owner-1" : "owner-2",
    });
    expect(result).toEqual({ kind: "blocked", reason: "account_mismatch" });
  });

  it("rejects a wrong authenticated owner before hashing", async () => {
    const source = workspace();
    expect(
      await preflightCanonicalOfflineWorkspaceSync({
        ...request(source, source, source),
        currentAuthenticatedAccountId: () => "owner-2",
      })
    ).toEqual({ kind: "blocked", reason: "account_mismatch" });
  });
});
