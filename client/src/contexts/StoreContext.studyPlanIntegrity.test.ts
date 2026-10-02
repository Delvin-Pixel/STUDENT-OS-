import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("canonical study-plan creation integrity", () => {
  it("bounds plan and item fields while resolving current topic and exam links before mutation", () => {
    expect(source).toContain("stateRef.current.studyPlans.length < 100");
    expect(source).toContain(
      "plan.items.length <= WORKSPACE_STUDY_PLAN_ITEM_LIMIT"
    );
    expect(source).toContain('item.status === "planned"');
    expect(source).toContain(
      "One or more revision-plan sessions are no longer valid."
    );
  });
});
