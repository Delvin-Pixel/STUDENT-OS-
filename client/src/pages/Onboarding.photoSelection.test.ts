import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Onboarding.tsx", import.meta.url)),
  "utf8"
);

describe("Onboarding profile-photo selection integrity", () => {
  it("lets only the latest asynchronous photo preparation update the selected image", () => {
    expect(source).toContain("const profilePhotoPreparationRef = useRef(0);");
    expect(source).toContain(
      "const preparationId = profilePhotoPreparationRef.current + 1;"
    );
    expect(source).toMatch(
      /if \(profilePhotoPreparationRef\.current !== preparationId\) return;/
    );
    expect(source).toMatch(
      /if \(profilePhotoPreparationRef\.current === preparationId\)\s*setIsPreparingPhoto\(false\);/
    );
  });
});
