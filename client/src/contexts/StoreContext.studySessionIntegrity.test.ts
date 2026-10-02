import "@shared/sourceAssertions";
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
const admissionSource = readFileSync(
  fileURLToPath(new URL("../lib/studySessionAdmission.ts", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("canonical study-session write integrity", () => {
  it("validates bounded session fields, capacity, lifecycle status, and canonical topic links", () => {
    expect(source).toContainSource(
      "admitPlannedStudySession(stateRef.current, s, link)"
    );
    expect(admissionSource).toContain("function normalizeStudySessionDraft");
    expect(admissionSource).toContain("WORKSPACE_STUDY_SESSION_LIMIT");
    expect(source).toContainSource("proposed.status !== current.status");
    expect(source).toContainSource(
      'stale_topic: "This session’s topic is no longer available."'
    );
    expect(admissionSource).toContainSource(
      'export type NewStudySession = Pick<StudySession, | "subject"'
    );
    expect(admissionSource).toContain(
      'if (!normalized || normalized.status !== "planned" || (link &&'
    );
    expect(source).toContainSource("{ ...s, ...proposed");
  });
});
