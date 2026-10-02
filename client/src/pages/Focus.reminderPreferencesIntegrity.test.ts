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

describe("Focus reminder preference integrity", () => {
  it("applies the shared quiet-hours and daily-cap limiter after adding the active focus reminder", () => {
    expect(source).toContain("limitPlannedPushReminders");
    expect(source).toContain("limitPlannedPushReminders(");
    expect(source).toContain("planDevicePushReminders(state)");
    expect(source).toContain("reminderToSync");
    expect(source).toContain("state");
  });
});
