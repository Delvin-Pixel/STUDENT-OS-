import {
  hasEntitlement,
  resolveEntitlementSnapshot,
  unavailableEntitlementSnapshot,
  type EntitlementFeature,
  type EntitlementSnapshot,
} from "@shared/entitlements";
import { eq } from "drizzle-orm";
import { subscriptions } from "../drizzle/schema";
import { getDb } from "./db";
import { logOperationalFailure } from "./safeOperationalLog";

/**
 * Reads the only server-authoritative subscription row for an account and
 * resolves it into a provider-neutral entitlement snapshot.
 *
 * No client-supplied plan/status value is accepted. If durable storage is
 * unavailable, Premium fails closed while Free/core capabilities remain usable.
 */
export async function getAccountEntitlements(
  openId: string,
  now = new Date()
): Promise<EntitlementSnapshot> {
  const db = await getDb();
  if (!db) return unavailableEntitlementSnapshot(now);

  try {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.openId, openId))
      .limit(1);
    return resolveEntitlementSnapshot(rows[0] ?? null, now);
  } catch (error) {
    logOperationalFailure("Entitlements", "Subscription lookup failed", error);
    return unavailableEntitlementSnapshot(now);
  }
}

export interface CapabilityAuthorization {
  allowed: boolean;
  feature: EntitlementFeature;
  snapshot: EntitlementSnapshot;
}

/**
 * Server-side capability gate for B59/B60 and later costly operations.
 * UI state is never sufficient authorization; callers must use the account
 * resolved from the authenticated server context.
 */
export async function authorizeAccountCapability(
  openId: string,
  feature: EntitlementFeature,
  now = new Date()
): Promise<CapabilityAuthorization> {
  const snapshot = await getAccountEntitlements(openId, now);
  return {
    allowed:
      snapshot.authorityStatus === "verified" &&
      hasEntitlement(snapshot, feature),
    feature,
    snapshot,
  };
}
