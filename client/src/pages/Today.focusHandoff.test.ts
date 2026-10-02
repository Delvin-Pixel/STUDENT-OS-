import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const todaySource = readFileSync(
  fileURLToPath(new URL("./Today.tsx", import.meta.url)),
  "utf8"
);
const focusSource = readFileSync(
  fileURLToPath(new URL("./Focus.tsx", import.meta.url)),
  "utf8"
);

describe("Today task-to-Focus handoff", () => {
  it("passes the canonical task identity and restores only an available incomplete task", () => {
    expect(todaySource).toContain("/focus?task=${encodeURIComponent(task.id)}");
    expect(focusSource).toContain(
      'candidate.id === routedTaskId && candidate.status !== "completed"'
    );
    expect(focusSource).toContain("setObjective(task.title)");
  });
});
