import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("canonical timer preference integrity", () => {
  it("rejects non-integer and schema-overflow timer preferences before mutation", () => {
    expect(source).toContain("!Number.isInteger(prefs.focus)");
    expect(source).toContain("prefs.focus > 240");
    expect(source).toContain("prefs.breakLen > 120");
    expect(source).toContain("prefs.preset.length > 1_000");
  });
});
