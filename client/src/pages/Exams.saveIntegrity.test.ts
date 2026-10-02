import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Exams.tsx", import.meta.url)),
  "utf8"
);

describe("Manual exam dialog save integrity", () => {
  it("validates before claiming and keeps create or edit details visible when the canonical write rejects", () => {
    expect(source).toContain("const saveClaimRef = useRef(false);");
    expect(source).toContain("saveClaimRef.current = false;");
    expect(source).toContain("const validationError = validateNewExam(exam);");
    expect(source).toContain("if (saveClaimRef.current) return;");
    expect(source).toContain("saveClaimRef.current = true;");
    expect(source).toContain("const accepted = onSave(exam);");
    expect(source).toContain("if (!accepted) {");
    expect(source).toContain("Your details are still here.");
    expect(source).toContain("onOpenChange(false);");
  });
});
