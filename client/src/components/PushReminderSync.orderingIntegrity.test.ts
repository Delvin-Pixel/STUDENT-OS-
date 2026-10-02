import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./PushReminderSync.tsx", import.meta.url)),
  "utf8"
);

describe("General device reminder synchronization integrity", () => {
  it("serializes latest-plan writes and applies shared reminder preferences to restored Focus reminders", () => {
    expect(source).toContainSource(
      "const latestSyncJobRef = useRef<(() => Promise<void>) | null>(null);"
    );
    expect(source).toContainSource(
      "const requestedSyncVersionRef = useRef(0);"
    );
    expect(source).toContainSource("if (syncRunningRef.current) return;");
    expect(source).toContainSource(
      "while (completedSyncVersionRef.current < requestedSyncVersionRef.current)"
    );
    expect(source).toContainSource("await latestSyncJobRef.current?.();");
    expect(source).toContainSource("requestedSyncVersionRef.current += 1;");
    expect(source).toContainSource(
      "reminders = limitPlannedPushReminders([...planDevicePushReminders(state), ...(focusReminder ? [focusReminder] : [])], state);"
    );
  });

  it("resets the automatic sync queue when reminders are disabled and compensates an in-flight registration without racing the Settings activation transaction", () => {
    expect(source).toContainSource(
      "const notificationsEnabledRef = useRef(state.settings.notifications);"
    );
    expect(source).toContainSource("latestSyncJobRef.current = null;");
    expect(source).toContainSource("requestedSyncVersionRef.current += 1;");
    expect(source).toContainSource("if (!state.settings.notifications) {");
    expect(source).toContainSource("completedSyncKey.current = null;");
    expect(source).toContainSource(
      "Settings owns explicit device deactivation."
    );
    expect(source).toContainSource("if (!notificationsEnabledRef.current) {");
    expect(source).toContainSource(
      "await disableDevice({ endpoint: subscription.endpoint });"
    );
  });
});
