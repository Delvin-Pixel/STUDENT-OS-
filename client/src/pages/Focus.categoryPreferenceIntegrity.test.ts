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

describe("Focus reminder-category preference integrity", () => {
  it("creates an active Focus completion reminder only when the Focus category is enabled", () => {
    expect(source).toContain(
      'phase === "focus" && state.settings.notificationPreferences.focus ? planFocusCompletionReminder('
    );
    expect(source).toContain(
      "saveActiveFocusReminder(accountCacheScope, focusReminder);"
    );
    expect(source).toContain("syncFocusReminder(focusReminder);");
  });
});
