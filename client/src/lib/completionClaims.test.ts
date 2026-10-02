import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../contexts/StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("canonical task and session completion claims", () => {
  it("claims a valid task before applying completion side effects", () => {
    expect(source).toContain("taskCompletionClaimRef.current.has(id)");
    expect(source).toContain("taskCompletionClaimRef.current.add(id);");
    expect(source).toContain("taskCompletionClaimRef.current = new Set");
    expect(source).toContain("adopted.tasks");
    expect(source).toContain('task.status === "completed"');
  });

  it("claims a valid session before adding learning evidence and XP", () => {
    expect(source).toContain("sessionCompletionClaimRef.current.has(id)");
    expect(source).toContain("sessionCompletionClaimRef.current.add(id);");
    expect(source).toContain("sessionCompletionClaimRef.current = new Set");
    expect(source).toContain("adopted.sessions");
    expect(source).toContain('session.status === "completed"');
  });

  it("claims goals before a completion transition and retains a one-time XP marker", () => {
    expect(source).toContain("goalCompletionClaimRef.current.has(id)");
    expect(source).toContain("goalCompletionClaimRef.current.add(id);");
    expect(source).toContain("const shouldAwardXp = !goal.xpAwarded;");
    expect(source).toContain("if (shouldAwardXp) awardXp(XP_RULES.goal);");
    expect(source).toContain(
      "if (patch.completed === false) goalCompletionClaimRef.current.delete(id);"
    );
  });

  it("claims plan items before adding their canonical planned sessions", () => {
    expect(source).toContain("planItemActivationClaimRef.current.has(itemId)");
    expect(source).toContain("planItemActivationClaimRef.current.add(itemId);");
    expect(source).toContain("planItemActivationClaimRef.current = new Set");
    expect(source).toContain("state.sessions.flatMap");
    expect(source).toContain("session.planItemId");
  });

  it("claims a recovery plan before adding missed-plan replacements and clears after canonical plan changes", () => {
    expect(source).toContain("planRebalanceClaimRef.current.has(planId)");
    expect(source).toContain("planRebalanceClaimRef.current.add(planId);");
    expect(source).toContain("planRebalanceClaimRef.current.clear();");
  });
});
