import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./AiScheduleDialog.tsx", import.meta.url)),
  "utf8"
);

describe("AI schedule application integrity", () => {
  it("keeps rejected reviewed proposals and avoids a false all-added confirmation", () => {
    expect(source).toContain("const acceptedIndexes = proposed.flatMap");
    expect(source).toContain("if (acceptedIndexes.length !== proposed.length)");
    expect(source).toContain("const rejected = draft.sessions.filter");
    expect(source).toContain(
      'proposal${rejected.length === 1 ? " remains" : "s remain"} for you to adjust and retry.'
    );
    expect(source).toContain("applyClaimRef.current = false");
  });
});
