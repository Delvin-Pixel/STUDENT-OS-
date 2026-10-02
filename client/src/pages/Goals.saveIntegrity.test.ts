import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Goals.tsx", import.meta.url)),
  "utf8"
);

describe("Manual goal dialog save integrity", () => {
  it("claims a valid goal submission before canonical creation and resets on opening", () => {
    expect(source).toContainSource("const saveClaimRef = useRef(false);");
    expect(source).toContainSource("if (open) saveClaimRef.current = false;");
    expect(source).toContainSource("if (saveClaimRef.current) return;");
    expect(source).toContainSource("saveClaimRef.current = true;");
    expect(source).toContainSource("if (!onSave(goal)) {");
  });

  it("keeps an omitted deadline as the canonical empty string and validates before claiming", () => {
    expect(source).toContainSource(
      'import { validateNewGoal } from "@/lib/goalValidation";'
    );
    expect(source).toContainSource(
      "const goal = { name: name.trim(), category, target, current: 0, unit, deadline };"
    );
    expect(source).toContainSource(
      "const validationError = validateNewGoal(goal);"
    );
    expect(source).toContainSource("saveClaimRef.current = false;");
  });
});
