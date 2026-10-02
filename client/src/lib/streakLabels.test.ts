import { describe, expect, it } from "vitest";
import { dayCountLabel, streakLabel } from "./utils";

describe("streak display labels", () => {
  it("uses singular grammar for one day", () => {
    expect(dayCountLabel(1)).toBe("1 day");
    expect(streakLabel(1)).toBe("1 day streak");
  });

  it("uses plural grammar for zero and multiple days", () => {
    expect(dayCountLabel(0)).toBe("0 days");
    expect(streakLabel(2)).toBe("2 days streak");
  });
});
