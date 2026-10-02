import { describe, expect, it } from "vitest";
import { idleTimerSeconds } from "./focusTimer";

describe("idleTimerSeconds", () => {
  it("uses the matching configured duration for each idle timer phase", () => {
    expect(idleTimerSeconds("focus", { focus: 25, breakLen: 5 })).toBe(1_500);
    expect(idleTimerSeconds("break", { focus: 25, breakLen: 5 })).toBe(300);
  });
});
