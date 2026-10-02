import { describe, expect, it } from "vitest";
import { validatedSessionSecret } from "./_core/sdk";

describe("session secret validation", () => {
  it("fails closed for missing or weak session secrets and accepts a 32-byte secret", () => {
    expect(() => validatedSessionSecret("")).toThrow(
      "session security configuration"
    );
    expect(() => validatedSessionSecret("too-short")).toThrow(
      "session security configuration"
    );
    expect(validatedSessionSecret("a".repeat(32))).toHaveLength(32);
  });
});
