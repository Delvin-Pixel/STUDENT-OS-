import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("owner notification operational logging", () => {
  it("does not read or write raw upstream response and exception details", () => {
    const source = readFileSync(
      new URL("./_core/notification.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("response.text()");
    expect(source).not.toContain("console.warn");
    expect(source).toContain("logOperationalFailure");
  });
});
