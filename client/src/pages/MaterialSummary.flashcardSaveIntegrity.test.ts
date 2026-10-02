import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./MaterialSummary.tsx", import.meta.url)),
  "utf8"
);

describe("Material-summary flashcard deck integrity", () => {
  it("resets a new summary draft claim and claims its flashcard deck before canonical creation", () => {
    expect(source).toContainSource(
      "const summaryFlashcardSaveClaimRef = useRef(false);"
    );
    expect(source).toContainSource(
      "if (draft) summaryFlashcardSaveClaimRef.current = false;"
    );
    expect(source).toContainSource(
      "if (summaryFlashcardSaveClaimRef.current) return;"
    );
    expect(source).toContainSource(
      "summaryFlashcardSaveClaimRef.current = true;"
    );
    expect(source).toMatch(
      /summaryFlashcardSaveClaimRef\.current = true;\s*const accepted = saveMaterialFlashcardDraft\(/
    );
    expect(source).toContainSource(
      "if (accepted) setSavedAsCards(true); else summaryFlashcardSaveClaimRef.current = false;"
    );
  });
});
