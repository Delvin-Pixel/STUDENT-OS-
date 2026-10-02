import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./AppShell.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("AppShell notification navigation semantics", () => {
  it("styles one notification anchor through Button asChild instead of nesting a button in a link", () => {
    expect(source).toContain("<Button");
    expect(source).toContain('variant="ghost"');
    expect(source).toContain("asChild");
    expect(source).toContain(
      '<Link href="/notifications" aria-label="Notifications">'
    );
    expect(source).not.toContain(
      '<Link href="/notifications" aria-label="Notifications"><Button'
    );
  });

  it("uses the shared dialog contract for global search focus management", () => {
    expect(source).toContain("Dialog");
    expect(source).toContain("DialogContent");
    expect(source).toContain("onOpenChange");
    expect(source).toContain("<DialogContent");
    expect(source).toContain("onOpenAutoFocus");
    expect(source).not.toContain('role="dialog"');
  });
});
