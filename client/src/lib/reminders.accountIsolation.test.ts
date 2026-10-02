import { describe, expect, it, vi } from "vitest";
import { sendNotification } from "./browserNotif";
import { reminderLogStorageKey, runReminders } from "./reminders";
import { emptyState } from "./storage";
import { todayStr } from "./utils";

vi.mock("./browserNotif", () => ({ sendNotification: vi.fn() }));

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("browser reminder account isolation", () => {
  it("does not let one account's matching task ID suppress another account's due reminder", () => {
    const storage = memoryStorage();
    const base = emptyState();
    const state = {
      ...base,
      settings: { ...base.settings, notifications: true },
      tasks: [
        {
          id: "shared-imported-task-id",
          title: "Finish revision",
          description: "",
          subject: "Maths",
          dueDate: todayStr(),
          priority: "medium" as const,
          status: "todo" as const,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    runReminders(state, "account-a", storage);
    runReminders(state, "account-b", storage);

    expect(vi.mocked(sendNotification)).toHaveBeenCalledTimes(2);
    expect(storage.values.has(reminderLogStorageKey("account-a"))).toBe(true);
    expect(storage.values.has(reminderLogStorageKey("account-b"))).toBe(true);
  });
});
