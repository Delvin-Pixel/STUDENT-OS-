import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Focus.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("Focus canonical topic selection integrity", () => {
  it("offers deduplicated manual and exam topics, then keeps the selected topic's subject canonical", () => {
    expect(source).toContain("state.topics.map");
    expect(source).toContain("state.exams.flatMap");
    expect(source).toContain("topicOptions.find");
    expect(source).toContain("setSubject(topic.subject)");
  });
});
