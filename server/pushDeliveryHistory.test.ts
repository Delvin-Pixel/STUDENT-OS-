import { describe, expect, it } from "vitest";
import {
  assertPushEndpointOwner,
  PUSH_DELIVERY_HISTORY_LIMIT,
  pushDeliveryStatusFromResponse,
} from "./pushDb";

describe("push delivery-history status mapping", () => {
  it("records accepted, retryable failure, and expired-subscription outcomes accurately", () => {
    expect(pushDeliveryStatusFromResponse(true, 201)).toBe("accepted");
    expect(pushDeliveryStatusFromResponse(false, 503)).toBe("failed");
    expect(pushDeliveryStatusFromResponse(false, 404)).toBe("expired");
    expect(pushDeliveryStatusFromResponse(false, 410)).toBe("expired");
  });

  it("keeps the private per-device timeline deliberately bounded", () => {
    expect(PUSH_DELIVERY_HISTORY_LIMIT).toBe(30);
  });

  it("never silently transfers an opaque device endpoint to another account", () => {
    expect(() => assertPushEndpointOwner("account-a", "account-b")).toThrow(
      "already registered"
    );
    expect(() =>
      assertPushEndpointOwner("account-a", "account-a")
    ).not.toThrow();
    expect(() => assertPushEndpointOwner(null, "account-a")).not.toThrow();
  });
});
