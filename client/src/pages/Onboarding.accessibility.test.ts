import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Onboarding.tsx", import.meta.url)),
  "utf8"
);

describe("Onboarding selection semantics", () => {
  it("exposes the selected state for every button-based choice group", () => {
    expect(source).toContain("aria-pressed={educationLevel === level.value}");
    expect(source).toContain("aria-pressed={selectedGoals.includes(goal)}");
    expect(source).toContain("aria-pressed={subjects.includes(subject)}");
    expect(source).toContain("aria-pressed={hours === option}");
  });
});
