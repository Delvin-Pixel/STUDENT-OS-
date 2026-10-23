import { describe, expect, it } from "vitest";
import {
  CAPABILITY_REGISTRY,
  CAPABILITY_UI_MAX_AGE_MS,
  decideCapability,
  type CapabilityContext,
} from "./capabilityAccess";
import {
  ENTITLEMENT_FEATURES,
  resolveEntitlementSnapshot,
  unavailableEntitlementSnapshot,
} from "./entitlements";

const now = Date.parse("2026-10-21T12:00:00Z");
const premium = resolveEntitlementSnapshot(
  { plan: "premium", provider: "manual", status: "active" },
  new Date(now)
);
const base: CapabilityContext = {
  accountId: "account-a",
  snapshotAccountId: "account-a",
  snapshot: premium,
  now,
  online: true,
  pending: false,
  failed: false,
};
const decide = (changes: Partial<CapabilityContext> = {}) =>
  decideCapability("advanced_reports", { ...base, ...changes });
describe("capability presentation trust boundaries", () => {
  it("keeps registry tiers aligned with canonical server Free capabilities", () => {
    const free = resolveEntitlementSnapshot(null, new Date(now));
    for (const feature of ENTITLEMENT_FEATURES) {
      expect(CAPABILITY_REGISTRY[feature].tier === "free").toBe(
        free.capabilities[feature]
      );
    }
  });
  it("covers every canonical capability without additional authority", () =>
    expect(Object.keys(CAPABILITY_REGISTRY).sort()).toEqual(
      [...ENTITLEMENT_FEATURES].sort()
    ));
  it("allows a fresh server grant and locks a server Free account", () => {
    expect(decide().state).toBe("allowed");
    expect(
      decide({ snapshot: resolveEntitlementSnapshot(null, new Date(now)) })
    ).toMatchObject({ state: "locked", reason: "premium_required" });
  });
  it("never shares account A's grant with account B", () =>
    expect(decide({ accountId: "account-b" })).toMatchObject({
      state: "error_fallback",
      reason: "account_mismatch",
    }));
  it("revokes cached premium offline, during revalidation and after errors", () => {
    expect(decide({ online: false }).state).toBe("offline_unverified");
    expect(decide({ pending: true }).state).toBe("loading");
    expect(decide({ failed: true }).state).toBe("error_fallback");
    expect(
      decide({ snapshot: unavailableEntitlementSnapshot(new Date(now)) }).state
    ).toBe("error_fallback");
  });
  it.each([now + CAPABILITY_UI_MAX_AGE_MS, now - 1, NaN])(
    "rejects stale/future/invalid clock context %s",
    clock => expect(decide({ now: clock }).state).toBe("error_fallback")
  );
  it.each(["invalid", new Date(now).toISOString()])(
    "rejects invalid or ended periods %s",
    currentPeriodEnd =>
      expect(decide({ snapshot: { ...premium, currentPeriodEnd } }).state).toBe(
        "error_fallback"
      )
  );
  it("does not infer a grant from a premium plan label", () =>
    expect(
      decide({
        snapshot: {
          ...premium,
          capabilities: { ...premium.capabilities, advanced_reports: false },
        },
      }).state
    ).toBe("locked"));
  it("keeps every Free capability usable through unavailable authority", () => {
    for (const feature of ENTITLEMENT_FEATURES.filter(
      f => CAPABILITY_REGISTRY[f].tier === "free"
    )) {
      expect(
        decideCapability(feature, {
          ...base,
          online: false,
          failed: true,
          pending: true,
          snapshot: undefined,
        }).state
      ).toBe("allowed");
    }
  });
});
