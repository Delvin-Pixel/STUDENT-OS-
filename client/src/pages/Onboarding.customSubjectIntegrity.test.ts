import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Onboarding.tsx", import.meta.url)),
  "utf8"
);

describe("Onboarding custom-subject integrity", () => {
  it("checks duplicate subjects inside the functional state transition", () => {
    expect(source).toMatch(/if \(value\)\s*setSubjects\(previous =>/);
    expect(source).toContain("subject => subject.toLocaleLowerCase()");
    expect(source).toContain("? previous");
    expect(source).toContain("[...previous, value]");
    expect(source).not.toContain("if (value && !subjects.some");
  });
});
