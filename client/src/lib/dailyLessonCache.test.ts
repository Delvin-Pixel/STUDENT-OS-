import { describe, expect, it } from "vitest";
import { dailyLessonCacheKey } from "./dailyLessonCache";

describe("Daily Lesson cache scope", () => {
  it("partitions device-local derived lesson cache entries by authenticated account", () => {
    expect(dailyLessonCacheKey("account-a")).not.toBe(
      dailyLessonCacheKey("account-b")
    );
    expect(dailyLessonCacheKey("account/a")).toContain("account%2Fa");
  });
});
