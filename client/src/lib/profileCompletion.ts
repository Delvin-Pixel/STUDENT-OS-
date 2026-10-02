import type { Profile } from "@/lib/types";

/**
 * React may apply an accepted profile write before the queued onboarding
 * completion update. Merge the completion name from the updater's current
 * profile, never from a stale render-time snapshot.
 */
export function withOnboardingName(
  profile: Profile | null | undefined,
  fallback: Profile,
  name: string
): Profile {
  return { ...(profile ?? fallback), name };
}
