import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Flashcards.tsx", import.meta.url)),
  "utf8"
);

describe("Flashcards review runner", () => {
  it("claims the current card before marking it and advancing the review", () => {
    expect(source).toContainSource(
      "const reviewedCardRef = useRef<string | null>(null);"
    );
    expect(source).toContainSource(
      "if (reviewedCardRef.current === card.id) return;"
    );
    expect(source).toContainSource("reviewedCardRef.current = card.id;");
    expect(source).toContainSource("onMark(card.id, grade, card);");
  });

  it("makes card faces keyboard-focusable and operable with Enter or Space", () => {
    expect(source).toContainSource("tabIndex={0}");
    expect(source).toContainSource("onKeyDown={handleFlipKeyDown}");
    expect(source).toContainSource(
      'if (event.key !== "Enter" && event.key !== " ") return;'
    );
    expect(source).toContainSource("event.preventDefault();");
  });

  it("clears a deleted active review deck from an effect rather than mutating state during render", () => {
    expect(source).toContainSource(
      "if (reviewing && !state.decks.some((deck) => deck.id === reviewing)) setReviewing(null);"
    );
    expect(source).toContainSource("}, [reviewing, state.decks]);");
    expect(source).toContainSource("if (!deck) return null;");
    expect(source).not.toContainSource(
      "if (!deck) { setReviewing(null); return null; }"
    );
  });
});
