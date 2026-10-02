import { isValidLocalIsoDate } from "@/lib/calendarValidation";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("canonical task deferral date integrity", () => {
  it("uses the shared local-calendar guard rather than a format-only date check", () => {
    expect(isValidLocalIsoDate("2026-02-29")).toBe(false);
    expect(isValidLocalIsoDate("2028-02-29")).toBe(true);
    expect(source).toContain(
      "!isValidLocalIsoDate(until) || until <= todayStr()"
    );
  });
});
