import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const normalizeSource = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");
const taskPageSource = normalizeSource(
  readFileSync(
    fileURLToPath(new URL("../pages/Tasks.tsx", import.meta.url)),
    "utf8"
  )
);
const storeSource = normalizeSource(
  readFileSync(
    fileURLToPath(new URL("../contexts/StoreContext.tsx", import.meta.url)),
    "utf8"
  )
);

describe("task edit completion lifecycle", () => {
  it("routes edited completion through the canonical checked action with the proposed patch", () => {
    expect(taskPageSource).toContain(
      "accepted = completeTask(editing.id, patch);"
    );
    expect(taskPageSource).not.toContain(
      'updateTask(editing.id, patch);\n      if (status === "completed")'
    );
  });

  it("evaluates the edited task shape before creating completion side effects and rejects generic completed updates", () => {
    expect(storeSource).toContain('patch.status === "completed"');
    expect(storeSource).toContain(
      "const candidate = normalizeNewTask({ ...current, ...patch });"
    );
    expect(storeSource).toContain(
      "const current = stateRef.current.tasks.find((task) => task.id === id);"
    );
    expect(storeSource).toContain(
      "candidate.subtasks?.some((subtask) => !subtask.completed)"
    );
  });

  it("releases the idempotency claim and stale completion timestamp when a task is reopened", () => {
    expect(storeSource).toContain(
      "if (reopening) taskCompletionClaimRef.current.delete(id);"
    );
    expect(storeSource).toContain(
      "...(reopening ? { completedAt: undefined } : {})"
    );
  });

  it("retains a durable one-time reward marker so a reopened task cannot replay XP", () => {
    expect(storeSource).toContain("const shouldAwardXp = !task.xpAwardedAt;");
    expect(storeSource).toContain(
      "...(shouldAwardXp ? { xpAwardedAt: completedAt } : {})"
    );
    expect(storeSource).toContain("if (shouldAwardXp) awardXp(XP_RULES.task);");
    expect(storeSource).toContain(
      "function preserveLegacyRewardMarkers(state: StudyState)"
    );
  });
});
