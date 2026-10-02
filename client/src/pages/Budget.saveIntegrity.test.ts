import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Budget.tsx", import.meta.url)),
  "utf8"
);

describe("Manual budget transaction save integrity", () => {
  it("claims a valid transaction submission before canonical creation and resets on opening", () => {
    expect(source).toContain("const saveClaimRef = useRef(false);");
    expect(source).toContain("if (open) saveClaimRef.current = false;");
    expect(source).toContain("if (saveClaimRef.current) return;");
    expect(source).toContain("saveClaimRef.current = true;");
    expect(source).toContain("if (!onSave(transaction)) {");
  });

  it("runs shared transaction validation before claiming and retains the form after canonical rejection", () => {
    expect(source).toContain(
      'import { validateNewTransaction } from "@/lib/transactionValidation";'
    );
    expect(source).toContain(
      "const validationError = validateNewTransaction(transaction);"
    );
    expect(source).toContain("if (!onSave(transaction)) {");
    expect(source).toContain("saveClaimRef.current = false;");
  });
});
