import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("canonical recurring timetable overlap integrity", () => {
  it("guards both event creation and editing through the shared weekly overlap helper", () => {
    expect(source).toContain(
      "if (hasTimetableEventOverlap(stateRef.current.events, event))"
    );
    expect(source).toContain(
      "if (hasTimetableEventOverlap(stateRef.current.events, proposed, id))"
    );
    expect(source).toContain(
      "recurring timetable event overlaps an existing weekly block"
    );
  });
});
