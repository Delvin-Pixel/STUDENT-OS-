import "@shared/sourceAssertions";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace conflict resolution contract", () => {
  it("exposes explicit cloud, local, and merge resolution paths", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "StoreContext.tsx"),
      "utf8"
    );
    expect(source).toContainSource(
      'resolveWorkspaceConflict: (resolution: "cloud" | "local" | "merge")'
    );
    expect(source).toContainSource('resolution === "cloud"');
    expect(source).toContainSource('resolution === "local"');
    expect(source).toContainSource(
      "mergeWorkspaceStates(remoteState, localState)"
    );
  });
});
