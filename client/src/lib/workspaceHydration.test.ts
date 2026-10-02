import { validateStudyState } from "@shared/workspaceSchema";
import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import { chooseHydratedWorkspace } from "./workspaceHydration";

function workspaceFor(name: string) {
  const state = emptyState();
  state.onboarded = true;
  state.profile = {
    name,
    studentType: "Secondary School",
    educationLevel: "Secondary",
    goals: [],
    subjects: ["Maths"],
    hoursPerDay: "1 hour",
  };
  state.tasks = [
    {
      id: "task",
      title: `${name}'s cloud task`,
      description: "",
      subject: "Maths",
      dueDate: "2026-08-25",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-22",
    },
  ];
  return state;
}

describe("authenticated workspace hydration policy", () => {
  it("restores a returning student's cloud workspace on a new device with no local cache", () => {
    const result = chooseHydratedWorkspace({
      local: emptyState(),
      localMeta: { revision: 0, pending: false, updatedAt: "" },
      remote: workspaceFor("Amina"),
      remoteRevision: 8,
      online: true,
      remoteAvailable: true,
    });
    expect(result.adoptedRemote).toBe(true);
    expect(result.state.profile?.name).toBe("Amina");
    expect(result.state.tasks[0].title).toBe("Amina's cloud task");
    expect(result.revision).toBe(8);
    expect(result.status).toBe("synced");
  });

  it("restores a legacy cloud workspace with the default currency instead of discarding it", () => {
    const legacy = workspaceFor("Amina") as unknown as {
      settings: Record<string, unknown>;
    };
    delete legacy.settings.currency;
    const parsed = validateStudyState(legacy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const result = chooseHydratedWorkspace({
      local: emptyState(),
      localMeta: { revision: 0, pending: false, updatedAt: "" },
      remote: parsed.data,
      remoteRevision: 5,
      online: true,
      remoteAvailable: true,
    });
    expect(result.adoptedRemote).toBe(true);
    expect(result.state.profile?.name).toBe("Amina");
    expect(result.state.settings.currency).toBe("GHS");
  });

  it("accepts a task with the durable completion XP marker while legacy tasks remain valid", () => {
    const current = workspaceFor("Amina");
    current.tasks[0] = {
      ...current.tasks[0],
      status: "completed",
      completedAt: "2026-08-22T12:00:00.000Z",
      xpAwardedAt: "2026-08-22T12:00:00.000Z",
    };
    expect(validateStudyState(current).success).toBe(true);
    delete (current.tasks[0] as { xpAwardedAt?: string }).xpAwardedAt;
    expect(validateStudyState(current).success).toBe(true);
  });

  it("accepts a goal with the durable completion XP marker while legacy goals remain valid", () => {
    const current = workspaceFor("Amina");
    current.goals = [
      {
        id: "goal",
        name: "Revise",
        target: 1,
        current: 1,
        deadline: "2026-08-25",
        category: "study",
        completed: true,
        xpAwarded: true,
        unit: "sessions",
      },
    ];
    expect(validateStudyState(current).success).toBe(true);
    delete (current.goals[0] as { xpAwarded?: boolean }).xpAwarded;
    expect(validateStudyState(current).success).toBe(true);
  });

  it("preserves unsynced local work while offline rather than overwriting it with a cloud copy", () => {
    const local = workspaceFor("Amina");
    local.tasks.push({
      id: "offline",
      title: "Offline revision",
      description: "",
      subject: "Maths",
      dueDate: "",
      priority: "high",
      status: "todo",
      createdAt: "2026-08-22",
    });
    const result = chooseHydratedWorkspace({
      local,
      localMeta: {
        revision: 8,
        pending: true,
        updatedAt: "2026-08-22T12:00:00Z",
      },
      remote: workspaceFor("Amina"),
      remoteRevision: 8,
      online: false,
      remoteAvailable: true,
    });
    expect(result.adoptedRemote).toBe(false);
    expect(result.state.tasks.map(task => task.id)).toContain("offline");
    expect(result.status).toBe("offline");
  });

  it("signals a recoverable failed cloud fetch while retaining the account-scoped local workspace", () => {
    const local = workspaceFor("Amina");
    const result = chooseHydratedWorkspace({
      local,
      localMeta: { revision: 4, pending: false, updatedAt: "" },
      remote: null,
      remoteRevision: 4,
      online: true,
      remoteAvailable: false,
    });
    expect(result.state.profile?.name).toBe("Amina");
    expect(result.status).toBe("failed");
  });
});
