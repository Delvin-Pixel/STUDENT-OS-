import type { ReactNode } from "react";
import { useCapability } from "@/contexts/EntitlementContext";
import {
  CAPABILITY_REGISTRY,
  type CapabilityState,
} from "@shared/capabilityAccess";
import type { EntitlementFeature } from "@shared/entitlements";

const messages: Record<Exclude<CapabilityState, "allowed">, string> = {
  loading: "Checking availability…",
  locked:
    "This optional capability requires Premium. Your core learning tools remain available.",
  offline_unverified:
    "Connect to verify this optional capability. Offline learning essentials remain available.",
  error_fallback:
    "Availability could not be verified. Your core learning tools remain available.",
};

export function FeatureGate({
  feature,
  children,
}: {
  feature: EntitlementFeature;
  children: ReactNode;
}) {
  const decision = useCapability(feature);
  if (decision.state === "allowed") return <>{children}</>;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={decision.state === "loading"}
      data-capability-state={decision.state}
      data-denial-reason={decision.reason}
      className="rounded-xl border border-border p-4 text-sm text-muted-foreground"
    >
      <p className="font-medium">{CAPABILITY_REGISTRY[feature].label}</p>
      <p>{messages[decision.state]}</p>
    </div>
  );
}
