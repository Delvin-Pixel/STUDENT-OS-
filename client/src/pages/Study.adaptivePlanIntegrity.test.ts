import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Study.tsx", import.meta.url)),
  "utf8"
);

describe("Adaptive revision-plan save integrity", () => {
  it("resets a claim for a fresh adaptive plan and claims it before canonical creation", () => {
    expect(source).toContain("const adaptivePlanSaveClaimRef = useRef(false);");
    expect(source).toContain("adaptivePlanSaveClaimRef.current = false;");
    expect(source).toContain("if (adaptivePlanSaveClaimRef.current) return;");
    expect(source).toContain("adaptivePlanSaveClaimRef.current = true;");
    expect(source).toMatch(
      /adaptivePlanSaveClaimRef\.current = true;\s*createStudyPlan\(/
    );
  });
});
