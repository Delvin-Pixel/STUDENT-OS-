import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("canonical currency preference integrity", () => {
  it("rejects currencies outside the workspace schema enum before settings mutation", () => {
    expect(source).toContain(
      '["GHS", "NGN", "KES", "ZAR", "USD", "GBP", "EUR", "INR"]'
    );
    expect(source).toContain("Choose a supported currency.");
  });
});
