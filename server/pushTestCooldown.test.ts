import { describe, expect, it } from "vitest";
import {
  PUSH_CONNECTION_TEST_COOLDOWN_MS,
  pushConnectionTestCooldownActive,
} from "./pushDb";

describe("push connection-test cooldown", () => {
  it("blocks only tests attempted within the configured one-minute window", () => {
    const now = new Date("2026-08-23T10:30:00Z");
    expect(pushConnectionTestCooldownActive(null, now)).toBe(false);
    expect(
      pushConnectionTestCooldownActive(
        new Date(now.getTime() - PUSH_CONNECTION_TEST_COOLDOWN_MS + 1),
        now
      )
    ).toBe(true);
    expect(
      pushConnectionTestCooldownActive(
        new Date(now.getTime() - PUSH_CONNECTION_TEST_COOLDOWN_MS),
        now
      )
    ).toBe(false);
  });
});
