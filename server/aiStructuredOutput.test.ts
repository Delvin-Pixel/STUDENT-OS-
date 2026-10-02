import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseStructuredOutput } from "./aiStructuredOutput";

describe("parseStructuredOutput", () => {
  const schema = z.object({ value: z.string().min(1) }).strict();

  it("accepts valid JSON and validates the shape", () => {
    expect(parseStructuredOutput('{"value":"ok"}', schema, "test")).toEqual({
      value: "ok",
    });
  });

  it("rejects non-JSON and does not partially accept it", () => {
    expect(() => parseStructuredOutput("not-json", schema, "test")).toThrow(
      /invalid JSON/i
    );
  });

  it("rejects oversized structured output", () => {
    expect(() =>
      parseStructuredOutput('{"value":"ok"}', schema, "test", 5)
    ).toThrow(/oversized/i);
  });

  it("rejects extra keys for strict schemas", () => {
    expect(() =>
      parseStructuredOutput('{"value":"ok","extra":true}', schema, "test")
    ).toThrow();
  });
});
