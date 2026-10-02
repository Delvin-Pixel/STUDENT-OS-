import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const config = readFileSync(
  fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  "utf8"
);

describe("production bundle configuration", () => {
  it("leaves vendor dependency ordering to Rollup rather than forcing cyclic manual chunks", () => {
    expect(config).not.toContain("manualChunks");
    expect(config).not.toContain('return "charts"');
    expect(config).toContain(
      'outDir: path.resolve(import.meta.dirname, "dist/public")'
    );
  });
});
