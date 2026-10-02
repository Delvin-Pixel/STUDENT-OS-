import { describe, expect, it } from "vitest";
import {
  PUSH_REMINDER_MAX_ATTEMPTS,
  pushRetryDelayMs,
  pushRetryDisposition,
} from "./pushDb";

describe("scheduled push retry policy", () => {
  it("uses bounded exponential backoff before terminal retirement", () => {
    expect(pushRetryDelayMs(1)).toBe(60_000);
    expect(pushRetryDelayMs(2)).toBe(5 * 60_000);
    const now = new Date("2026-08-23T10:00:00.000Z");
    expect(pushRetryDisposition(1, now)).toEqual({
      retired: false,
      nextAttemptAt: new Date("2026-08-23T10:01:00.000Z"),
    });
    expect(pushRetryDisposition(PUSH_REMINDER_MAX_ATTEMPTS, now)).toEqual({
      retired: true,
      nextAttemptAt: null,
    });
  });
});
