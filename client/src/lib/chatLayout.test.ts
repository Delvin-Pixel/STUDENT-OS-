import { describe, expect, it } from "vitest";
import { chatMessageMinHeight } from "./chatLayout";

describe("chat message viewport sizing", () => {
  it("adapts to available height without returning a negative layout value", () => {
    expect(chatMessageMinHeight(600, 80)).toBe(432);
    expect(chatMessageMinHeight(60, 80)).toBe(0);
  });
});
