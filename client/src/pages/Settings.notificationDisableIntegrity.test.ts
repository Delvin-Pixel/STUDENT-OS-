import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Settings.tsx", import.meta.url)),
  "utf8"
);

describe("Settings notification-disable integrity", () => {
  it("uses a monotonic toggle guard and compensates a stale successful registration when reminders were turned off", () => {
    expect(source).toContainSource(
      "const notificationToggleVersionRef = useRef(0);"
    );
    expect(source).toContainSource(
      "const notificationDesiredRef = useRef(state.settings.notifications);"
    );
    expect(source).toContainSource(
      "const toggleVersion = ++notificationToggleVersionRef.current;"
    );
    expect(source).toMatch(
      /const isCurrentToggle = \(\) =>\s*notificationToggleVersionRef\.current === toggleVersion;/
    );
    expect(source).toContainSource("if (!isCurrentToggle()) {");
    expect(source).toMatch(
      /await disablePush\.mutateAsync\(\{\s*endpoint\s*\}\);/
    );
    expect(source).toContainSource(
      "await disablePush.mutateAsync({ endpoint: activation.endpoint });"
    );
    expect(source).toContainSource("await unsubscribeDevicePush();");
  });
});
