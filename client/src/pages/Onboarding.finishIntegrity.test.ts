import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Onboarding.tsx", import.meta.url)),
  "utf8"
);

describe("Onboarding completion integrity", () => {
  it("claims workspace completion before profile upload and releases only after a failed attempt", () => {
    expect(source).toContain("const onboardingFinishClaimRef = useRef(false);");
    expect(source).toContain("if (onboardingFinishClaimRef.current) return;");
    expect(source).toContain("onboardingFinishClaimRef.current = true;");
    expect(source).toContain(
      "const profilePhotoStorageKey = profilePhotoDataUrl"
    );
    expect(source).toContain("await uploadProfilePhoto.mutateAsync({");
    expect(source).toContain("onboardingFinishClaimRef.current = false;");
    expect(source).toContain("const accepted = setProfile({");
    expect(source).toContain("if (!accepted || !markOnboarded(displayName))");
  });
});
