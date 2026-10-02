import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("session authentication operational logging", () => {
  it("does not serialize raw JWT or OAuth sync errors into server logs", () => {
    const source = readFileSync(
      new URL("./_core/sdk.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain('Session verification failed", String(error)');
    expect(source).not.toContain('Failed to sync user from OAuth:", error');
    expect(source).toContain(
      'logOperationalFailure("Auth", "Session verification failed", error)'
    );
    expect(source).toContain(
      'logOperationalFailure("Auth", "OAuth user sync failed", error)'
    );
  });
});
