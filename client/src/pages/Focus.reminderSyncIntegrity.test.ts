import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Focus.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("Focus reminder synchronization integrity", () => {
  it("serializes device writes and replays the latest requested timer reminder state", () => {
    expect(source).toContain(
      "const latestFocusReminderRef = useRef<ReturnType<typeof planFocusCompletionReminder>>(null);"
    );
    expect(source).toContain(
      "const requestedFocusReminderSyncRef = useRef(0);"
    );
    expect(source).toContain(
      "const completedFocusReminderSyncRef = useRef(0);"
    );
    expect(source).toContain(
      "if (focusReminderSyncRunningRef.current) return;"
    );
    expect(source).toContain(
      "while (completedFocusReminderSyncRef.current < requestedFocusReminderSyncRef.current)"
    );
    expect(source).toContain(
      "const reminderToSync = latestFocusReminderRef.current;"
    );
    expect(source).toContain(
      "completedFocusReminderSyncRef.current = syncVersion;"
    );
  });
});
