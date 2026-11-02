import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import {
  proposeOfflineWorkspaceRebase,
  type OfflineWorkspaceRebaseRequest,
} from "./offlineWorkspaceRebase";
import type { StudyState, Task } from "./types";

function task(id: string, title: string): Task {
  return {
    id,
    title,
    description: "",
    subject: "Mathematics",
    dueDate: "",
    priority: "medium",
    status: "todo",
    createdAt: "2026-10-26T00:00:00.000Z",
  };
}

function workspace(): StudyState {
  const state = emptyState();
  state.profile = {
    name: "Sample learner",
    studentType: "Secondary School",
    educationLevel: "Secondary",
    classLevel: "SHS 2",
    goals: [],
    subjects: ["Mathematics"],
    hoursPerDay: "1 hour",
  };
  return state;
}

function request(
  base: StudyState,
  local: StudyState,
  remote: StudyState,
  currentAuthenticatedAccountId: () => string | null = () => "owner-1"
): OfflineWorkspaceRebaseRequest {
  return {
    currentAuthenticatedAccountId,
    accountId: "owner-1",
    base: { workspace: base, revision: 5 },
    local: { workspace: local, revision: 5 },
    remote: { workspace: remote, revision: 6 },
  };
}

describe("B64.4 pure conflict-safe offline rebase proposal", () => {
  it("proposes a disjoint record rebase without writing either source", async () => {
    const base = workspace();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks.push(task("local-task", "Local study"));
    remote.tasks.push(task("remote-task", "Remote study"));

    const result = await proposeOfflineWorkspaceRebase(
      request(base, local, remote)
    );

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") return;
    expect(result.decision).toBe("safe_rebase");
    expect(result.expectedRemoteRevision).toBe(6);
    expect(result.workspace.tasks.map(item => item.id).sort()).toEqual([
      "local-task",
      "remote-task",
    ]);
    expect(result.writesPerformed).toBe(false);
    expect(result.requiresRevisionCheckedWrite).toBe(true);
    expect(base.tasks).toHaveLength(0);
    expect(local.tasks.map(item => item.id)).toEqual(["local-task"]);
    expect(remote.tasks.map(item => item.id)).toEqual(["remote-task"]);
  });

  it("combines edits to different nested flashcards and retains parent identity", async () => {
    const base = workspace();
    base.decks.push({
      id: "deck-1",
      name: "Algebra",
      subject: "Mathematics",
      createdAt: "2026-10-26T00:00:00.000Z",
      cards: [
        {
          id: "card-1",
          front: "x + 2 = 5",
          back: "x = 3",
          status: "new",
        },
        {
          id: "card-2",
          front: "2x = 8",
          back: "x = 4",
          status: "new",
        },
      ],
    });
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.decks[0].cards[0].back = "Subtract 2 from both sides";
    remote.decks[0].cards[1].back = "Divide both sides by 2";

    const result = await proposeOfflineWorkspaceRebase(
      request(base, local, remote)
    );

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") return;
    expect(result.workspace.decks[0].cards).toEqual([
      {
        id: "card-1",
        front: "x + 2 = 5",
        back: "Subtract 2 from both sides",
        status: "new",
      },
      {
        id: "card-2",
        front: "2x = 8",
        back: "Divide both sides by 2",
        status: "new",
      },
    ]);
  });

  it("holds competing edits to the same record for manual review", async () => {
    const base = workspace();
    base.tasks.push(task("task-1", "Original"));
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks[0].title = "Local title";
    remote.tasks[0].title = "Remote title";

    expect(
      await proposeOfflineWorkspaceRebase(request(base, local, remote))
    ).toMatchObject({
      kind: "held",
      reason: "manual_review",
    });
  });

  it("holds delete-versus-edit instead of resurrecting a record", async () => {
    const base = workspace();
    base.tasks.push(task("task-1", "Original"));
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks = [];
    local.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-10-27T00:00:00.000Z",
    });
    remote.tasks[0].title = "Remote edit";

    expect(
      await proposeOfflineWorkspaceRebase(request(base, local, remote))
    ).toMatchObject({
      kind: "held",
      reason: "manual_review",
    });
  });

  it("preserves tombstones while proposing a disjoint remote addition", async () => {
    const base = workspace();
    base.tasks.push(task("task-1", "Remove this"));
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks = [];
    local.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-10-27T00:00:00.000Z",
    });
    remote.tasks.push(task("task-2", "Remote addition"));

    const result = await proposeOfflineWorkspaceRebase(
      request(base, local, remote)
    );

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") return;
    expect(result.workspace.tasks.map(item => item.id)).toEqual(["task-2"]);
    expect(result.workspace.syncTombstones).toContainEqual({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-10-27T00:00:00.000Z",
    });
  });

  it("holds scalar/root conflicts rather than guessing field-level policy", async () => {
    const base = workspace();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.settings.theme = "dark";
    remote.xp = 25;

    expect(
      await proposeOfflineWorkspaceRebase(request(base, local, remote))
    ).toMatchObject({
      kind: "held",
      reason: "manual_review",
    });
  });

  it("excludes device-private feedback and transient signed URLs", async () => {
    const base = workspace();
    if (!base.profile) throw new Error("fixture profile missing");
    base.profile.profilePhotoUrl = "https://signed.example/old";
    base.aiAnswerRatings.push({
      answerId: "answer-1",
      surface: "assistant",
      rating: "down",
      answerPreview: "private preview",
      ratedAt: "2026-10-26T00:00:00.000Z",
    });
    base.tasks.push(task("base-task", "Keep base"));
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.tasks.push(task("local-task", "Local addition"));
    remote.tasks.push(task("remote-task", "Remote addition"));
    if (!remote.profile) throw new Error("fixture profile missing");
    remote.profile.profilePhotoUrl = "https://signed.example/new";

    const result = await proposeOfflineWorkspaceRebase(
      request(base, local, remote)
    );

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") return;
    expect(result.workspace.aiAnswerRatings).toEqual([]);
    expect(result.workspace.profile?.profilePhotoUrl).toBe("");
  });

  it("blocks immediately when the authenticated account does not match", async () => {
    const base = workspace();
    const result = await proposeOfflineWorkspaceRebase(
      request(
        base,
        structuredClone(base),
        structuredClone(base),
        () => "owner-2"
      )
    );
    expect(result).toEqual({ kind: "held", reason: "account_mismatch" });
  });

  it("does not return write authorization for unchanged snapshots", async () => {
    const base = workspace();
    expect(
      await proposeOfflineWorkspaceRebase(
        request(base, structuredClone(base), structuredClone(base))
      )
    ).toMatchObject({
      kind: "held",
      reason: "not_rebase_required",
    });
  });
});
