import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Leaderboard.tsx", import.meta.url)),
  "utf8"
);

describe("Friendly leaderboard participant creation integrity", () => {
  it("claims a valid participant before canonical creation and resets when the dialog opens", () => {
    expect(source).toContain("const participantClaimRef = useRef(false);");
    expect(source).toContain("if (open) participantClaimRef.current = false;");
    expect(source).toContain("if (participantClaimRef.current) return;");
    expect(source).toContain("participantClaimRef.current = true;");
    expect(source).toContain("addFriend(name.trim(), emoji, level);");
  });
});
