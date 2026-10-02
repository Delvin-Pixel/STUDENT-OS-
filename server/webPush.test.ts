import { describe, expect, it } from "vitest";
import { buildPushConnectionTestPayload } from "./webPush";

describe("Student OS push connection test payload", () => {
  it("uses a privacy-safe notification that opens the reminder settings", () => {
    expect(buildPushConnectionTestPayload()).toEqual({
      title: "We’ve got you on check",
      body: "Student OS reminders are active on this device.",
      targetUrl: "/settings",
      tag: "studentos-push-activation-confirmation",
    });
  });

  it("carries a selected vibration sequence in the real activation confirmation payload", () => {
    expect(buildPushConnectionTestPayload([80, 40, 80]).vibration).toEqual([
      80, 40, 80,
    ]);
  });
});
