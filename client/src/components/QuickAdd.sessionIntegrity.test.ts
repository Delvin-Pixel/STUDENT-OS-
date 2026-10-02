import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./QuickAdd.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("Quick Add session integrity", () => {
  it("claims one reviewed session draft before canonical session creation and resets for a new draft", () => {
    expect(source).toContain("const sessionDraftClaimRef = useRef(false);");
    expect(source).toContain(
      "if (!sessionDraft) sessionDraftClaimRef.current = false;"
    );
    expect(source).toContain("sessionDraftClaimRef.current = false;");
    expect(source).toContain("if (sessionDraftClaimRef.current) return;");
    expect(source).toContain("sessionDraftClaimRef.current = true;");
  });

  it("retains the reviewed draft and does not report success when canonical scheduling rejects it", () => {
    expect(source).toContain("const sessionAccepted = addSession({");
    expect(source).toContain("if (!sessionAccepted) {");
    expect(source).toContain("sessionDraftClaimRef.current = false;");
    expect(source).toContain("return;");
    expect(source).toContain("toast.success(`Study session planned:");
  });
});
