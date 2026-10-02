import { recordTaskWork } from "@/lib/taskExecution";
import type { Task } from "@/lib/types";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");
const task = {
  id: "task-1",
  title: "Revise",
  subject: "Math",
  status: "todo",
  priority: "medium",
  createdAt: "2026-08-25",
} as Task;

describe("canonical task-work integrity", () => {
  it("does not let non-finite runtime input reach the helper that records evidence", () => {
    expect(source).toContain(
      "!Number.isFinite(minutes) || (progressPercent !== undefined && !Number.isFinite(progressPercent))"
    );
    expect(recordTaskWork(task, 30, "2026-08-25T10:00:00Z")).toMatchObject({
      actualMinutes: 30,
      progressPercent: 0,
    });
  });
});
