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

describe("Focus timer completion integrity", () => {
  it("uses the persisted active timer duration instead of a changed preference at completion", () => {
    expect(source).toContain("const completedTimer = timerRef.current");
    expect(source).toContain(
      "completedTimer?.durationSeconds ?? prefs.focus * 60"
    );
  });

  it("does not report a recorded Focus session when canonical recording rejects it", () => {
    expect(source).toContain(
      "const accepted = addFocusSession(subject, duration"
    );
    expect(source).toContain("accepted ? `Focus session done!");
    expect(source).toContain("could not record this session");
  });
});
