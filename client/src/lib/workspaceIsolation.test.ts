import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import type { StudyState } from "./types";
import { prepareLocalWorkspaceForAccount } from "./workspaceIsolation";

function workspaceFor(name: string): StudyState {
  return {
    ...emptyState(),
    onboarded: true,
    profile: {
      name,
      age: 16,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: ["Prepare for exams"],
      subjects: ["Mathematics"],
      hoursPerDay: "1 hour",
    },
    tasks: [
      {
        id: "task-1",
        title: `${name}'s private task`,
        description: "",
        subject: "Mathematics",
        dueDate: "2026-08-18",
        priority: "medium",
        status: "todo",
        createdAt: "2026-08-17",
      },
    ],
  };
}

describe("prepareLocalWorkspaceForAccount", () => {
  it("keeps a returning student's cached workspace only for the same account", () => {
    const saved = workspaceFor("Ada");

    const result = prepareLocalWorkspaceForAccount(
      saved,
      "account-ada",
      "account-ada"
    );

    expect(result.replaced).toBe(false);
    expect(result.state.profile?.name).toBe("Ada");
    expect(result.state.tasks).toHaveLength(1);
  });

  it("clears a previous student's cached profile and tasks for a different account", () => {
    const saved = workspaceFor("Ada");

    const result = prepareLocalWorkspaceForAccount(
      saved,
      "account-ada",
      "account-kofi"
    );

    expect(result.replaced).toBe(true);
    expect(result.state.profile).toBeNull();
    expect(result.state.onboarded).toBe(false);
    expect(result.state.tasks).toEqual([]);
  });

  it("treats an unowned legacy cache as private and starts a new account cleanly", () => {
    const saved = workspaceFor("Ada");

    const result = prepareLocalWorkspaceForAccount(saved, null, "account-kofi");

    expect(result.replaced).toBe(true);
    expect(result.state.profile).toBeNull();
    expect(result.state.tasks).toEqual([]);
  });
});
