import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  fileURLToPath(new URL("../client/index.html", import.meta.url)),
  "utf8"
);

describe("production analytics template", () => {
  it("does not emit unresolved analytics placeholders into the HTML shell", () => {
    expect(html).not.toContain("%VITE_ANALYTICS_ENDPOINT%");
    expect(html).not.toContain("%VITE_ANALYTICS_WEBSITE_ID%");
  });
});
