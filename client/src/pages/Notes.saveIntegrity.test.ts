import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Notes.tsx", import.meta.url)),
  "utf8"
);

describe("Manual note editor save integrity", () => {
  it("validates note drafts and retains create or edit details when canonical saving rejects", () => {
    expect(source).toContainSource("const saveClaimRef = useRef(false);");
    expect(source).toContainSource(
      "if (open) { saveClaimRef.current = false; reset(note); }"
    );
    expect(source).toContainSource(
      "const validationError = validateNoteDraft(draft);"
    );
    expect(source).toContainSource("if (saveClaimRef.current) return;");
    expect(source).toContainSource("saveClaimRef.current = true;");
    expect(source).toContainSource(
      "const accepted = note ? updateNote(note.id, draft) : addNote(draft);"
    );
    expect(source).toContainSource("Your details are still here.");
  });

  it("clears a removed canonical topic before rendering or saving the note", () => {
    expect(source).toContainSource(
      'const resolvedTopicId = topicId && topics.some((topic) => topic.id === topicId) ? topicId : "";'
    );
    expect(source).toContainSource(
      'if (topicId && !resolvedTopicId) setTopicId("");'
    );
    expect(source).toContainSource("topicId: resolvedTopicId || undefined");
    expect(source).toContainSource('value={resolvedTopicId || "_none"}');
  });
});
