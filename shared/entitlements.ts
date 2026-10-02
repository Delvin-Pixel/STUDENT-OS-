/**
 * Canonical Student OS plan and entitlement model.
 *
 * This module deliberately contains no payment-provider logic. Billing systems
 * may update a server-side subscription record later, but every product surface
 * consumes the same resolved entitlement snapshot.
 */

export const ENTITLEMENT_SCHEMA_VERSION = 1 as const;

/**
 * External billing authority must be revalidated regularly. B58.1 uses a
 * conservative 48-hour window with a small clock-skew allowance; B61 may
 * revise this only alongside real provider reconciliation/webhook semantics.
 */
export const EXTERNAL_ENTITLEMENT_VERIFICATION_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const EXTERNAL_ENTITLEMENT_VERIFICATION_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type StudentOsPlan = "free" | "premium";
export type SubscriptionStatus =
  "active" | "trial" | "past_due" | "canceled" | "expired";
export type SubscriptionProvider = "none" | "paystack" | "hubtel" | "manual";

export const ENTITLEMENT_FEATURES = [
  "core_learning",
  "core_transition",
  "core_offline",
  "ai_assistant",
  "advanced_ai_coach",
  "ai_study_material_generation",
  "advanced_quiz_generation",
  "advanced_mastery_analytics",
  "advanced_adaptive_planning",
  "advanced_reports",
  "expanded_cloud_storage",
  "premium_customization",
  "early_access",
] as const;

export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number];

export interface EntitlementUsageLimits {
  aiRequestsPerMinute: number;
  aiRequestsPerDay: number;
  materialFilesPerAccount: number;
  materialBytesPerAccount: number;
  workspaceBytes: number;
}

export interface SubscriptionRecordLike {
  plan: StudentOsPlan;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
  lastVerifiedAt?: Date | string | null;
}

export type EntitlementReason =
  | "no_subscription"
  | "free_subscription"
  | "subscription_metadata_invalid"
  | "premium_active"
  | "premium_trial"
  | "premium_canceled_until_period_end"
  | "subscription_period_ended"
  | "subscription_inactive"
  | "entitlement_store_unavailable";

export interface EntitlementSnapshot {
  schemaVersion: typeof ENTITLEMENT_SCHEMA_VERSION;
  plan: StudentOsPlan;
  subscriptionPlan: StudentOsPlan;
  subscriptionStatus: SubscriptionStatus | "none";
  provider: SubscriptionProvider;
  reason: EntitlementReason;
  authorityStatus: "verified" | "unavailable";
  evaluatedAt: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  capabilities: Record<EntitlementFeature, boolean>;
  usageLimits: EntitlementUsageLimits;
}

export const STUDENT_OS_PLAN_CATALOG = {
  free: {
    id: "free" as const,
    currency: "GHS" as const,
    monthlyPriceMinor: 0,
  },
  premium: {
    id: "premium" as const,
    currency: "GHS" as const,
    monthlyPriceMinor: 4_900,
  },
} as const;

const CORE_CAPABILITIES: Record<EntitlementFeature, boolean> = {
  core_learning: true,
  core_transition: true,
  core_offline: true,
  ai_assistant: true,
  advanced_ai_coach: false,
  ai_study_material_generation: false,
  advanced_quiz_generation: false,
  advanced_mastery_analytics: false,
  advanced_adaptive_planning: false,
  advanced_reports: false,
  expanded_cloud_storage: false,
  premium_customization: false,
  early_access: false,
};

const PREMIUM_CAPABILITIES: Record<EntitlementFeature, boolean> = {
  ...CORE_CAPABILITIES,
  advanced_ai_coach: true,
  ai_study_material_generation: true,
  advanced_quiz_generation: true,
  advanced_mastery_analytics: true,
  advanced_adaptive_planning: true,
  advanced_reports: true,
  expanded_cloud_storage: true,
  premium_customization: true,
  early_access: true,
};

/**
 * B58 keeps the existing production safety ceilings unchanged for both plans.
 * B60 will connect these limits to server authorization and may safely raise
 * Premium allowances after cost/load validation instead of guessing here.
 */
export const ENTITLEMENT_BASELINE_LIMITS: EntitlementUsageLimits = {
  aiRequestsPerMinute: 12,
  aiRequestsPerDay: 120,
  materialFilesPerAccount: 100,
  materialBytesPerAccount: 50_000_000,
  workspaceBytes: 4 * 1024 * 1024,
};

function dateOrUndefined(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isoOrUndefined(value?: Date | string | null): string | undefined {
  return dateOrUndefined(value)?.toISOString();
}

function snapshot(
  plan: StudentOsPlan,
  subscription: SubscriptionRecordLike | null,
  reason: EntitlementReason,
  now: Date
): EntitlementSnapshot {
  return {
    schemaVersion: ENTITLEMENT_SCHEMA_VERSION,
    plan,
    subscriptionPlan: subscription?.plan ?? "free",
    subscriptionStatus: subscription?.status ?? "none",
    provider: subscription?.provider ?? "none",
    reason,
    authorityStatus: "verified",
    evaluatedAt: now.toISOString(),
    ...(isoOrUndefined(subscription?.currentPeriodEnd)
      ? { currentPeriodEnd: isoOrUndefined(subscription?.currentPeriodEnd) }
      : {}),
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    capabilities: {
      ...(plan === "premium" ? PREMIUM_CAPABILITIES : CORE_CAPABILITIES),
    },
    usageLimits: { ...ENTITLEMENT_BASELINE_LIMITS },
  };
}

/**
 * Resolves the effective plan from server-owned subscription data.
 * Missing, malformed/ended, past-due, or expired records fail closed to Free.
 * A canceled subscription keeps Premium only until a recorded future period end.
 */
export function resolveEntitlementSnapshot(
  subscription: SubscriptionRecordLike | null | undefined,
  now = new Date()
): EntitlementSnapshot {
  if (!subscription) return snapshot("free", null, "no_subscription", now);
  if (subscription.plan === "free") {
    return snapshot("free", subscription, "free_subscription", now);
  }

  if (subscription.status === "past_due" || subscription.status === "expired") {
    return snapshot("free", subscription, "subscription_inactive", now);
  }

  if (subscription.provider === "none") {
    return snapshot("free", subscription, "subscription_metadata_invalid", now);
  }

  const periodEnd = dateOrUndefined(subscription.currentPeriodEnd);
  const externalProvider =
    subscription.provider === "paystack" || subscription.provider === "hubtel";

  if (externalProvider) {
    const providerSubscriptionId = subscription.providerSubscriptionId?.trim();
    const lastVerifiedAt = dateOrUndefined(subscription.lastVerifiedAt);
    if (!providerSubscriptionId || !periodEnd || !lastVerifiedAt) {
      return snapshot(
        "free",
        subscription,
        "subscription_metadata_invalid",
        now
      );
    }

    const verificationAgeMs = now.getTime() - lastVerifiedAt.getTime();
    if (
      verificationAgeMs > EXTERNAL_ENTITLEMENT_VERIFICATION_MAX_AGE_MS ||
      verificationAgeMs < -EXTERNAL_ENTITLEMENT_VERIFICATION_FUTURE_SKEW_MS
    ) {
      return snapshot(
        "free",
        subscription,
        "subscription_metadata_invalid",
        now
      );
    }
  }

  // Manual non-expiring Premium is intentionally allowed only for an active
  // server-owned grant. Manual trials/cancellations still need an end date.
  if (
    subscription.provider === "manual" &&
    subscription.status !== "active" &&
    !periodEnd
  ) {
    return snapshot("free", subscription, "subscription_metadata_invalid", now);
  }

  if (periodEnd && periodEnd.getTime() <= now.getTime()) {
    return snapshot("free", subscription, "subscription_period_ended", now);
  }

  if (subscription.status === "active") {
    return snapshot("premium", subscription, "premium_active", now);
  }
  if (subscription.status === "trial" && periodEnd) {
    return snapshot("premium", subscription, "premium_trial", now);
  }
  if (subscription.status === "canceled" && periodEnd) {
    return snapshot(
      "premium",
      subscription,
      "premium_canceled_until_period_end",
      now
    );
  }

  return snapshot("free", subscription, "subscription_inactive", now);
}

export function hasEntitlement(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature
): boolean {
  return snapshot.capabilities[feature] === true;
}

/**
 * Fail-closed fallback used when the server cannot reach its entitlement store.
 * Core Free capabilities stay available, but Premium is never inferred locally.
 */
export function unavailableEntitlementSnapshot(
  now = new Date()
): EntitlementSnapshot {
  return {
    ...snapshot("free", null, "entitlement_store_unavailable", now),
    authorityStatus: "unavailable",
  };
}
