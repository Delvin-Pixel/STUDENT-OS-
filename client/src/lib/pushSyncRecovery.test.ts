import { describe, expect, it } from "vitest";
import { devicePushSyncKey } from "./pushSyncRecovery";

describe("device push synchronization recovery", () => {
  it("permits a retry of the same unchanged plan after a browser reconnect", () => {
    const initial = devicePushSyncKey(
      "https://push.example.test/sub",
      "same-plan",
      0
    );
    expect(
      devicePushSyncKey("https://push.example.test/sub", "same-plan", 0)
    ).toBe(initial);
    expect(
      devicePushSyncKey("https://push.example.test/sub", "same-plan", 1)
    ).not.toBe(initial);
  });
});
