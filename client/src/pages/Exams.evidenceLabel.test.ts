import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Exams.tsx", import.meta.url)),
  "utf8"
);

describe("Exam Center readiness evidence presentation", () => {
  it("labels checklist or mixed readiness as an estimate and reserves direct-evidence language for complete direct coverage", () => {
    expect(source).toContainSource(
      "const allTopicsHaveDirectEvidence = Boolean(total > 0 && briefing?.evidenceBackedTopics === total);"
    );
    expect(source).toContainSource(
      'allTopicsHaveDirectEvidence ? "Direct-evidence readiness" : "Readiness estimate"'
    );
    expect(source).toContainSource(
      "practice and quizzes provide learning evidence"
    );
  });
});
