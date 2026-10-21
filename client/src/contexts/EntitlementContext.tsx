import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import {
  decideCapability,
  CAPABILITY_UI_MAX_AGE_MS,
  type CapabilityContext,
} from "@shared/capabilityAccess";
import type { EntitlementFeature } from "@shared/entitlements";

const EntitlementContext = createContext<CapabilityContext | null>(null);

/** Mounted under the authenticated account key; never stored in StudyState/storage. */
export function EntitlementProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const utils = trpc.useUtils();
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine
  );
  const [now, setNow] = useState(Date.now);
  const query = useQuery({
    queryKey: ["account-capabilities", accountId],
    queryFn: async () => ({
      accountId,
      snapshot: await utils.client.entitlements.me.query(),
    }),
    enabled: online,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setNow(Date.now());
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  // One expiry wake-up per snapshot, not periodic polling or background network use.
  const evaluatedAt = query.data?.snapshot.evaluatedAt;
  const periodEnd = query.data?.snapshot.currentPeriodEnd;
  useEffect(() => {
    if (!evaluatedAt) return;
    const deadline = Math.min(
      Date.parse(evaluatedAt) + CAPABILITY_UI_MAX_AGE_MS,
      periodEnd === undefined ? Infinity : Date.parse(periodEnd)
    );
    const delay = deadline - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, CAPABILITY_UI_MAX_AGE_MS)
    );
    return () => window.clearTimeout(timer);
  }, [evaluatedAt, periodEnd]);
  return (
    <EntitlementContext.Provider
      value={{
        accountId,
        snapshotAccountId: query.data?.accountId,
        snapshot: query.data?.snapshot,
        online,
        pending: query.isPending || query.isFetching,
        failed: query.isError,
        now,
      }}
    >
      {children}
    </EntitlementContext.Provider>
  );
}

export function useCapability(feature: EntitlementFeature) {
  const context = useContext(EntitlementContext);
  if (!context) throw new Error("useCapability requires EntitlementProvider");
  return decideCapability(feature, {
    ...context,
    now: Math.max(context.now, Date.now()),
  });
}
