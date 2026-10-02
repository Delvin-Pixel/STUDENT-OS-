import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Exams.tsx", import.meta.url)),
  "utf8"
);

describe("Exam Center topic creation integrity", () => {
  it("claims one valid topic per exam input and retains the draft if the target exam is gone", () => {
    expect(source).toContain(
      "const topicCreationClaimsRef = useRef(new Set<string>());"
    );
    expect(source).toContain(
      "if (!name || topicCreationClaimsRef.current.has(examId)) return;"
    );
    expect(source).toContain("topicCreationClaimsRef.current.add(examId);");
    expect(source).toContain("const accepted = addExamTopic(examId, name);");
    expect(source).toContain("if (!accepted) {");
    expect(source).toContain("topicCreationClaimsRef.current.delete(examId);");
    expect(source).toContain("topicCreationClaimsRef.current.delete(e.id);");
    expect(source.match(/submitTopic\(e\.id\);/g)).toHaveLength(2);
  });
});
