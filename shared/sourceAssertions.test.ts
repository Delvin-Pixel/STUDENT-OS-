import { describe, expect, it } from "vitest";
import { containsSource } from "./sourceAssertions";

describe("format-independent source contracts", () => {
  it("accepts only formatting differences", () => {
    expect(
      containsSource(
        "items.map( item => save({ id: item.id, }) )",
        "items.map((item) => save({id: item.id}))"
      )
    ).toBe(true);
  });
  it("still rejects removed guards, changed owners, operators, and literal contents", () => {
    expect(containsSource("save();", "if (claimed) return;")).toBe(false);
    expect(containsSource("save(input.user)", "save(ctx.user)")).toBe(false);
    expect(
      containsSource(
        "if (owner === user) return;",
        "if (owner !== user) return;"
      )
    ).toBe(false);
    expect(containsSource('show("keep draft")', 'show("keepdraft")')).toBe(
      false
    );
  });
});
