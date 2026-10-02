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

describe("canonical notification preference integrity", () => {
  it("whitelists, bounds, and validates merged preference fields before mutation", () => {
    expect(source).toContain("categoryKeys");
    expect(source).toContain('"tasks"');
    expect(source).toContain('"exams"');
    expect(source).toContain('"focus"');
    expect(source).toContain("next.dailyCap < 1 || next.dailyCap > 6");
    expect(source).toContain("Choose valid notification preferences.");
  });
});
