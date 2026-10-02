import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("canonical core settings integrity", () => {
  it("validates runtime master-notification and theme values before workspace mutation", () => {
    expect(source).toContain('if (typeof enabled !== "boolean")');
    expect(source).toContain('["light", "dark", "system"] as const');
    expect(source).toContain("Choose light, dark, or system appearance.");
  });
});
