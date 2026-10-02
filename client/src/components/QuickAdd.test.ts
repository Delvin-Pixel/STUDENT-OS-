import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./QuickAdd.tsx", import.meta.url)),
  "utf8"
);

describe("Quick Add dialog semantics", () => {
  it("provides a title within its focus-managed dialog", () => {
    expect(source).toContainSource(
      'import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";'
    );
    expect(source).toContainSource(
      '<DialogTitle className="sr-only">Quick add</DialogTitle>'
    );
  });
});
