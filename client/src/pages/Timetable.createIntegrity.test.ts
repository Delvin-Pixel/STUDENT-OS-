import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Timetable.tsx", import.meta.url)),
  "utf8"
);

describe("Timetable event creation integrity", () => {
  it("claims valid new recurring event submissions before their canonical save and resets when opened", () => {
    expect(source).toContainSource("const saveClaimRef = useRef(false);");
    expect(source).toContainSource("if (open) saveClaimRef.current = false;");
    expect(source).toContainSource(
      "if (!editing && saveClaimRef.current) return;"
    );
    expect(source).toContainSource(
      "if (!editing) saveClaimRef.current = true;"
    );
    expect(source).toContainSource(
      "onSave={(data) => editing ? updateEvent(editing.id, data) : addEvent(data)}"
    );
  });

  it("keeps create and edit details visible when canonical overlap validation rejects the save", () => {
    expect(source).toContainSource("const accepted = onSave(");
    expect(source).toContainSource("if (!accepted) {");
    expect(source).toContainSource("Your details are still here");
    expect(source).toContainSource(
      "if (!editing) saveClaimRef.current = false;"
    );
  });
});
