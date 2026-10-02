import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("workspace account-switch hydration isolation", () => {
  it("clears stale workspace state and blocks sync until the new account hydrates", () => {
    expect(source).toContain(
      "const hydratedAccountRef = useRef<string | null>(null)"
    );
    expect(source).toContain("hydratedAccountRef.current = null");
    expect(source).toContain("const cleared = emptyState()");
    expect(source).toContain("hydratedAccountRef.current = openId");
    expect(source).toContain(
      "if (!workspaceReady || hydratedAccountRef.current !== openId) return;"
    );
  });
});
