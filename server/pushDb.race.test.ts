import { describe, expect, it } from "vitest";
import {
  assertPushEndpointOwner,
  isDuplicatePushEndpointError,
} from "./pushDb";

describe("push endpoint registration race safeguards", () => {
  it("recognizes duplicate-key races while leaving unrelated persistence failures visible", () => {
    expect(isDuplicatePushEndpointError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(
      isDuplicatePushEndpointError({
        message: "Duplicate entry 'endpoint' for key 'push_devices.endpoint'",
      })
    ).toBe(true);
    expect(isDuplicatePushEndpointError(new Error("network unavailable"))).toBe(
      false
    );
  });

  it("refuses to update an endpoint that the duplicate-key winner owns under another account", () => {
    expect(() => assertPushEndpointOwner("account-a", "account-b")).toThrow(
      "already registered to another Student OS account"
    );
    expect(() =>
      assertPushEndpointOwner("account-a", "account-a")
    ).not.toThrow();
  });
});
