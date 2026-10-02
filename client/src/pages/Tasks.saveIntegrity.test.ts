import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Tasks.tsx", import.meta.url)),
  "utf8"
);

describe("Manual task-dialog save integrity", () => {
  it("claims a valid dialog submission before canonical task creation and resets on opening", () => {
    expect(source).toContainSource("const saveClaimRef = useRef(false);");
    expect(source).toContainSource("if (open) saveClaimRef.current = false;");
    expect(source).toContainSource("if (saveClaimRef.current) return;");
    expect(source).toContainSource("saveClaimRef.current = true;");
    expect(source).toContainSource("onSave({ title: title.trim()");
    expect(source).toContainSource("let accepted = false;");
    expect(source).toContainSource("if (!accepted) return false;");
    expect(source).toContainSource(")) saveClaimRef.current = false;");
  });

  it("offers combined canonical manual and exam topics and synchronizes a selected topic subject", () => {
    expect(source).toContainSource(
      "const topicOptions = useMemo(() => Array.from(new Map(["
    );
    expect(source).toContainSource(
      "...state.exams.flatMap((exam) => exam.topics.map((topic) => [topic.id"
    );
    expect(source).toContainSource(
      "const selected = topicOptions.find((topic) => topic.id === next);"
    );
    expect(source).toContainSource(
      "if (selected) setSubject(selected.subject);"
    );
  });
});
