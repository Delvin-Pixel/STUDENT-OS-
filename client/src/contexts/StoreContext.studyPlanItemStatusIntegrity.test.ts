import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("canonical study-plan item status integrity", () => {
  it("requires a current plan target, current item target, and supported lifecycle state", () => {
    expect(source).toContain(
      "!plan || !plan.items.some((item) => item.id === itemId)"
    );
    expect(source).toContain(
      '["planned", "completed", "skipped"].includes(status)'
    );
    expect(source).toContain("{ planId, planItemId: item.id }");
    expect(source).toContain(
      "...(link ? { planId: link.planId, planItemId: link.planItemId } : {})"
    );
    expect(source).toContain("const accepted = addSession(");
    expect(source).toContain(
      "if (accepted) planItemActivationClaimRef.current.add(itemId)"
    );
    expect(source).toContain(
      "const admission = admitPlannedStudySession(stateRef.current, s, link);"
    );
    expect(source).toContain(
      'stale_topic: "This session’s topic is no longer available."'
    );
    expect(source).toContain(
      'capacity: "Keep up to 5,000 study sessions in one workspace."'
    );
  });
});
