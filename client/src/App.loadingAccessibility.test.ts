import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./App.tsx", import.meta.url)),
  "utf8"
);

describe("shared loading accessibility", () => {
  it("uses live regions, busy state, and reduced-motion fallbacks", () => {
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("motion-reduce:animate-none");
  });
});
