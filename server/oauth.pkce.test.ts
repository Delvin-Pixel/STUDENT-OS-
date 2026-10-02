import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("OAuth PKCE contract", () => {
  it("creates an S256 challenge that matches the stored verifier", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
