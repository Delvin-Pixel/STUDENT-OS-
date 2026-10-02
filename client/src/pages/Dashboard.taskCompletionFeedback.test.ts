import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Dashboard.tsx", import.meta.url)),
  "utf8"
);

describe("Dashboard task completion feedback integrity", () => {
  it("only triggers celebration after canonical task completion succeeds", () => {
    expect(source).toContainSource(
      'if (t.status !== "completed" && completeTask(t.id)) {'
    );
    expect(source).toContainSource("setBurst((b) => b + 1);");
    expect(source).not.toContainSource(
      "completeTask(t.id);\n                      logActivity();"
    );
    expect(source).not.toContainSource(
      "const { state, completeTask, logActivity, setTheme } = useStore();"
    );
  });
});
