import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Onboarding.tsx", import.meta.url)),
  "utf8"
).replace(/\s+/g, " ");
const store = readFileSync(
  fileURLToPath(new URL("../contexts/StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("onboarding curriculum catalogue integrity", () => {
  it("makes the cited catalogue optional, preserves custom subjects, and pins its canonical profile provenance fields", () => {
    expect(source).toContain("Where do you study?");
    expect(source).toContain("ACADEMIC_CONTEXT_OPTIONS");
    expect(source).toContain("...(countryCode ? { countryCode } : {})");
    expect(source).toContain("Use the Ghana NaCCA secondary catalogue");
    expect(source).toMatch(
      /Optional\. Matching subjects are marked with this cited catalogue version; anything else you add stays custom\./
    );
    expect(source).toContain(
      "subjectProvenanceForGhanaNaccaSecondary(subjects)"
    );
    expect(source).toContain(
      'if (level.value !== "Secondary") setUseGhanaNaccaCatalogue(false)'
    );
    expect(store).toContain("hasValidAcademicContext");
    expect(store).toContain("countryCode.trim().toUpperCase()");
    expect(store).toContain("hasValidSubjectProvenance");
    expect(store).toContain('provenance.kind === "catalogue"');
  });
});
