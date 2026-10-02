import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./MaterialSummary.tsx", import.meta.url)),
  "utf8"
);

describe("AI material-draft binding integrity", () => {
  it("invalidates stale material responses and saves reviewed artifacts through their originating material", () => {
    expect(source).toContainSource(
      "summaryRequestMaterialRef.current = null; practiceRequestMaterialRef.current = null;"
    );
    expect(source).toContainSource(
      "if (summaryRequestMaterialRef.current !== material.storageKey) return;"
    );
    expect(source).toContainSource(
      "if (practiceRequestMaterialRef.current !== material.storageKey) return;"
    );
    expect(source).toContainSource(
      "const { draft: summaryDraft, consentAt } = value;"
    );
    expect(source).toContainSource(
      "setDraft({ ...summaryDraft, material, consentAt });"
    );
    expect(source).toContainSource(
      "setMaterialQuestionDraft({ ...value.draft, material });"
    );
    expect(source).toContainSource(
      "subject: currentTopic?.subject ?? draft.material.subject"
    );
    expect(source).toContainSource(
      "subject: currentTopic?.subject ?? materialQuestionDraft.material.subject"
    );
  });
});
