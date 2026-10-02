import { afterEach, describe, expect, it, vi } from "vitest";
import { logOperationalFailure } from "./safeOperationalLog";

describe("privacy-safe operational logs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records only an error category rather than a potentially sensitive exception message", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logOperationalFailure(
      "AI",
      "fallback",
      new Error("Bearer private-token and student answer")
    );
    expect(warn).toHaveBeenCalledWith("[AI] fallback", { errorType: "Error" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-token");
  });
});
