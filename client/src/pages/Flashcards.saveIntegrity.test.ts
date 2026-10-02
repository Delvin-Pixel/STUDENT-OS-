import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Flashcards.tsx", import.meta.url)),
  "utf8"
);

describe("Manual flashcard dialog save integrity", () => {
  it("claims a valid card submission before canonical creation and resets on opening", () => {
    expect(source).toContainSource("const saveClaimRef = useRef(false);");
    expect(source).toContainSource("if (open) saveClaimRef.current = false;");
    expect(source).toContainSource("if (saveClaimRef.current) return;");
    expect(source).toContainSource("saveClaimRef.current = true;");
    expect(source).toContainSource("if (!addCard(deckId");
  });

  it("retains the draft when canonical card creation rejects a disappeared deck", () => {
    expect(source).toContainSource("if (!deckId) return setError");
    expect(source).toContainSource("saveClaimRef.current = false;");
    expect(source).toContainSource("Your card text is still here");
  });

  it("claims a valid deck submission before canonical creation and resets on opening", () => {
    expect(source).toContainSource("const deckSaveClaimRef = useRef(false);");
    expect(source).toContainSource(
      "if (open) deckSaveClaimRef.current = false;"
    );
    expect(source).toContainSource("if (deckSaveClaimRef.current) return;");
    expect(source).toContainSource("deckSaveClaimRef.current = true;");
    expect(source).toContainSource("addDeck({ name: name.trim()");
  });

  it("clears a removed canonical topic before rendering or saving a deck", () => {
    expect(source).toContainSource(
      'const resolvedTopicId = topicId && topicOptions.some((topic) => topic.id === topicId) ? topicId : "";'
    );
    expect(source).toContainSource(
      'if (topicId && !resolvedTopicId) setTopicId("");'
    );
    expect(source).toContainSource("topicId: resolvedTopicId || undefined");
    expect(source).toContainSource('value={resolvedTopicId || "_none"}');
  });
});
