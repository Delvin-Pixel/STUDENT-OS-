import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("canonical learner-profile integrity", () => {
  it("normalizes bounded profile fields and rejects malformed updates before canonical mutation", () => {
    expect(source).toContain(
      "function normalizeProfile(value: Profile): Profile | null"
    );
    expect(source).toContain(
      "if (!Array.isArray(items) || items.length > maximum) return null;"
    );
    expect(source).toContain("clean.length");
    expect(source).toContain("toLocaleLowerCase");
    expect(source).toContain("value.age");
    expect(source).toContain("value.age < 3");
    expect(source).toContain("normalizeProfile");
    expect(source).toContain("stateRef.current.profile");
    expect(source).toContain("...patch");
    expect(source).toContain(
      "Choose valid profile details before saving them."
    );
    expect(source).toContain(
      "withOnboardingName(prev.profile, DEFAULT_PROFILE, name)"
    );
    expect(source).not.toContain("profile: preview,");
  });
});
