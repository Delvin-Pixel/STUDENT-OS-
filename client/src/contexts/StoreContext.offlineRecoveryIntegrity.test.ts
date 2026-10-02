import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace offline recovery wiring", () => {
  const source = readFileSync(
    resolve(process.cwd(), "client/src/contexts/StoreContext.tsx"),
    "utf8"
  );

  it("retries after reconnect and app wake events", () => {
    expect(source).toContain('window.addEventListener("online", handleOnline)');
    expect(source).toContain('window.addEventListener("focus", handleFocus)');
    expect(source).toContain(
      'window.addEventListener("pageshow", handlePageShow)'
    );
    expect(source).toContain(
      'document.addEventListener("visibilitychange", handleVisibility)'
    );
  });

  it("does not schedule a sync wake while offline or before hydration", () => {
    expect(source).toContain(
      "if (!workspaceReady || !navigator.onLine) return;"
    );
  });

  it("debounces multiple wake signals into one retry", () => {
    expect(source).toContain(
      "wakeTimer = setTimeout(() => setSyncAttempt(attempt => attempt + 1), 250);"
    );
  });
});
