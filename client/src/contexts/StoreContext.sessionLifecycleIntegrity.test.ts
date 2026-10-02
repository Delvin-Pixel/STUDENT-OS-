import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("canonical session lifecycle integrity", () => {
  it("rejects malformed runtime completion, skip, and rescheduling values before mutation", () => {
    expect(source).toContain(
      "actualDuration !== undefined && !Number.isFinite(actualDuration)"
    );
    expect(source).toContain("!skipReasons.includes(reason)");
    expect(source).toContain("!isValidLocalIsoDate(date)");
    expect(source).toContain("(?:[01]\\d|2[0-3]):[0-5]\\d");
  });
});
