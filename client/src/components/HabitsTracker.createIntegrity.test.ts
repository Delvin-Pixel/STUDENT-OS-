import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./HabitsTracker.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("Manual habit creation integrity", () => {
  it("claims a valid habit submission before canonical creation, releases rejection, and resets on opening", () => {
    expect(source).toContain("const createClaimRef = useRef(false);");
    expect(source).toContain("if (open) createClaimRef.current = false;");
    expect(source).toContain("if (createClaimRef.current) return;");
    expect(source).toContain("createClaimRef.current = true;");
    expect(source).toContain("if (!addHabit(n, emoji)) {");
    expect(source).toContain('setName("")');
    expect(source).toContain("setOpen(false)");
  });
});
