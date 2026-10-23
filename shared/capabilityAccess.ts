import {
  ENTITLEMENT_SCHEMA_VERSION,
  type EntitlementFeature,
  type EntitlementSnapshot,
} from "./entitlements";

/** Presentation metadata only. Server entitlements remain the authority. */
export const CAPABILITY_REGISTRY = {
  core_learning: { label: "Core learning", tier: "free" },
  core_transition: { label: "Education transitions", tier: "free" },
  core_offline: { label: "Offline essentials", tier: "free" },
  ai_assistant: { label: "AI assistant", tier: "free" },
  advanced_ai_coach: { label: "Advanced AI coaching", tier: "premium" },
  ai_study_material_generation: {
    label: "Advanced study materials",
    tier: "premium",
  },
  advanced_quiz_generation: {
    label: "Advanced quiz generation",
    tier: "premium",
  },
  advanced_mastery_analytics: {
    label: "Advanced mastery analytics",
    tier: "premium",
  },
  advanced_adaptive_planning: {
    label: "Advanced adaptive planning",
    tier: "premium",
  },
  advanced_reports: { label: "Advanced reports", tier: "premium" },
  expanded_cloud_storage: { label: "Expanded cloud storage", tier: "premium" },
  premium_customization: { label: "Premium customization", tier: "premium" },
  early_access: { label: "Early access", tier: "premium" },
} as const satisfies Record<
  EntitlementFeature,
  { label: string; tier: "free" | "premium" }
>;

export type CapabilityState =
  "loading" | "allowed" | "locked" | "offline_unverified" | "error_fallback";
export type CapabilityReason =
  | "free_core"
  | "server_granted"
  | "checking"
  | "premium_required"
  | "network_unavailable"
  | "authority_unavailable"
  | "snapshot_expired"
  | "account_mismatch";
export interface CapabilityDecision {
  feature: EntitlementFeature;
  state: CapabilityState;
  reason: CapabilityReason;
}
export interface CapabilityContext {
  accountId: string;
  snapshotAccountId?: string;
  snapshot?: EntitlementSnapshot;
  online: boolean;
  pending: boolean;
  failed: boolean;
  now: number;
}
export const CAPABILITY_UI_MAX_AGE_MS = 5 * 60 * 1000;

/** UX gate only: protected operations must independently authorize on the server. */
export function decideCapability(
  feature: EntitlementFeature,
  context: CapabilityContext
): CapabilityDecision {
  const result = (
    state: CapabilityState,
    reason: CapabilityReason
  ): CapabilityDecision => ({ feature, state, reason });
  if (CAPABILITY_REGISTRY[feature].tier === "free")
    return result("allowed", "free_core");
  if (!context.online)
    return result("offline_unverified", "network_unavailable");
  if (context.pending) return result("loading", "checking");
  if (context.snapshotAccountId !== context.accountId)
    return result("error_fallback", "account_mismatch");
  const snapshot = context.snapshot;
  if (
    context.failed ||
    !snapshot ||
    snapshot.schemaVersion !== ENTITLEMENT_SCHEMA_VERSION ||
    snapshot.authorityStatus !== "verified"
  )
    return result("error_fallback", "authority_unavailable");
  const evaluatedAt = Date.parse(snapshot.evaluatedAt);
  const end =
    snapshot.currentPeriodEnd === undefined
      ? Infinity
      : Date.parse(snapshot.currentPeriodEnd);
  if (
    !Number.isFinite(context.now) ||
    !Number.isFinite(evaluatedAt) ||
    evaluatedAt > context.now ||
    context.now - evaluatedAt >= CAPABILITY_UI_MAX_AGE_MS ||
    Number.isNaN(end) ||
    end <= context.now
  )
    return result("error_fallback", "snapshot_expired");
  return snapshot.capabilities[feature] === true
    ? result("allowed", "server_granted")
    : result("locked", "premium_required");
}
