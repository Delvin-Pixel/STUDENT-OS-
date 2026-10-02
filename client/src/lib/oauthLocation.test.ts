import { describe, expect, it } from "vitest";
import { getAuthenticatedLocationWithoutOAuthError } from "./oauthLocation";

describe("getAuthenticatedLocationWithoutOAuthError", () => {
  it("removes only a stale OAuth error while preserving the route, remaining query, and hash", () => {
    expect(
      getAuthenticatedLocationWithoutOAuthError(
        "https://studentos.example/dashboard?authError=invalid%20oauth%20state&tab=today#focus"
      )
    ).toBe("/dashboard?tab=today#focus");
  });

  it("does not rewrite locations that do not contain an OAuth error", () => {
    expect(
      getAuthenticatedLocationWithoutOAuthError(
        "https://studentos.example/?tab=today"
      )
    ).toBeNull();
  });
});
