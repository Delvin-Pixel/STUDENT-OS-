import { describe, expect, it } from "vitest";
import {
  hasEntitlement,
  resolveEntitlementSnapshot,
  STUDENT_OS_PLAN_CATALOG,
} from "./entitlements";

const now = new Date("2026-09-27T12:00:00Z");

describe("Student OS entitlements", () => {
  it("defaults safely to Free when no server subscription exists", () => {
    const result = resolveEntitlementSnapshot(null, now);
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("no_subscription");
    expect(hasEntitlement(result, "core_learning")).toBe(true);
    expect(hasEntitlement(result, "advanced_ai_coach")).toBe(false);
  });

  it("grants Premium for an active server-owned premium record", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "paystack",
        providerSubscriptionId: "sub_active_1",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
        lastVerifiedAt: "2026-09-27T11:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("premium");
    expect(result.reason).toBe("premium_active");
    expect(hasEntitlement(result, "advanced_mastery_analytics")).toBe(true);
    expect(hasEntitlement(result, "core_offline")).toBe(true);
  });

  it("keeps canceled Premium until the recorded paid period ends", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "canceled",
        provider: "hubtel",
        providerSubscriptionId: "sub_cancel_1",
        currentPeriodEnd: "2026-09-30T00:00:00Z",
        lastVerifiedAt: "2026-09-27T11:00:00Z",
        cancelAtPeriodEnd: true,
      },
      now
    );
    expect(result.plan).toBe("premium");
    expect(result.reason).toBe("premium_canceled_until_period_end");
  });

  it("fails closed after the paid period ends", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "paystack",
        providerSubscriptionId: "sub_expired_1",
        currentPeriodEnd: "2026-09-26T23:59:59Z",
        lastVerifiedAt: "2026-09-27T11:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_period_ended");
  });

  it("does not grant Premium for a past-due record", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "past_due",
        provider: "paystack",
        providerSubscriptionId: "sub_active_1",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
        lastVerifiedAt: "2026-09-27T11:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_inactive");
  });

  it("fails closed when active external Premium lacks a period end", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "paystack",
        providerSubscriptionId: "sub_missing_period",
        lastVerifiedAt: "2026-09-27T11:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("fails closed when external Premium lacks provider subscription identity", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "hubtel",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
        lastVerifiedAt: "2026-09-27T11:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("fails closed when external Premium lacks verification metadata", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "trial",
        provider: "paystack",
        providerSubscriptionId: "sub_trial",
        currentPeriodEnd: "2026-10-01T12:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("fails closed when external verification metadata is stale", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "paystack",
        providerSubscriptionId: "sub_stale",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
        lastVerifiedAt: "2026-09-25T11:59:59Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("fails closed when external verification metadata is implausibly future-dated", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "hubtel",
        providerSubscriptionId: "sub_future",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
        lastVerifiedAt: "2026-09-27T12:06:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("fails closed when external verification metadata is malformed", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "paystack",
        providerSubscriptionId: "sub_bad_date",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
        lastVerifiedAt: "not-a-date",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("fails closed when the provider is none", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "none",
        currentPeriodEnd: "2026-10-27T12:00:00Z",
      },
      now
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("subscription_metadata_invalid");
  });

  it("allows an explicit non-expiring manual active grant", () => {
    const result = resolveEntitlementSnapshot(
      {
        plan: "premium",
        status: "active",
        provider: "manual",
      },
      now
    );
    expect(result.plan).toBe("premium");
    expect(result.reason).toBe("premium_active");
  });

  it("keeps the agreed monthly Premium catalogue price centralized", () => {
    expect(STUDENT_OS_PLAN_CATALOG.premium).toMatchObject({
      currency: "GHS",
      monthlyPriceMinor: 4_900,
    });
  });
});
