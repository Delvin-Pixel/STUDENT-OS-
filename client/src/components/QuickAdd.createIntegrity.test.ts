import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./QuickAdd.tsx", import.meta.url)),
  "utf8"
);

describe("Quick Add creation integrity", () => {
  it("resets a creation claim for each opening and claims task, card, and expense mutations", () => {
    expect(source).toContain("const creationClaimRef = useRef(false);");
    expect(source).toContain("if (open) creationClaimRef.current = false;");
    expect(
      source.match(/if \(creationClaimRef\.current\) return;/g)
    ).toHaveLength(3);
    expect(source.match(/creationClaimRef\.current = true;/g)).toHaveLength(3);
    expect(source).toMatch(
      /case "task":\s*\{\s*if \(creationClaimRef\.current\) return;\s*creationClaimRef\.current = true;\s*const taskAccepted = addTask\(/
    );
    expect(source).toMatch(
      /if \(parts\.length >= 2 && firstDeck\) \{\s*if \(creationClaimRef\.current\) return;\s*creationClaimRef\.current = true;\s*const cardAccepted = addCard\(/
    );
    expect(source).toContain("const cardAccepted = addCard(firstDeck.id");
    expect(source).toContain("if (!cardAccepted) {");
    expect(source).toMatch(
      /if \(validQuickAddExpenseAmount\(amount\)\) \{\s*if \(creationClaimRef\.current\) return;\s*creationClaimRef\.current = true;\s*const transactionAccepted = addTransaction\(/
    );
    expect(source).toContain("if (!transactionAccepted) {");
    expect(source).toContainSource(
      "if (!taskAccepted) { creationClaimRef.current = false; return; }"
    );
    expect(source).toContain("creationClaimRef.current = false;");
  });
});
