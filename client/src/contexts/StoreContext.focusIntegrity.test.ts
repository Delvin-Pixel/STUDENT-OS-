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

describe("StoreContext canonical Focus-session integrity", () => {
  it("validates canonical input and reports whether Focus completion was recorded", () => {
    expect(source).toContain(
      "const validationError = validateFocusSessionInput(input);"
    );
    expect(source).toContain(
      "addFocusSession: (subject: string, duration: number, objective?: { taskId?: string; topicId?: string; objective?: string }) => boolean;"
    );
    expect(source).toContain(
      "stateRef.current.focusSessions.length >= WORKSPACE_FOCUS_SESSION_LIMIT"
    );
  });

  it("omits a removed topic rather than writing orphaned Focus evidence", () => {
    expect(source).toContain("const currentTopic = objective?.topicId ? [");
    expect(source).toContain(
      "The selected Focus topic was removed, so this session was saved without linked learning evidence."
    );
    expect(source).toContain("const topicId = currentTopic?.id;");
    expect(source).toContain(
      'subject: currentTopic.subject, kind: "study_session"'
    );
  });
});
