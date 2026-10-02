export type AnalyticsScriptConfig = {
  src: string;
  websiteId: string;
};

/**
 * Analytics is optional. A malformed or absent build-time configuration must
 * omit the integration instead of leaving an unresolved template URL in the
 * application shell.
 */
export function resolveAnalyticsScriptConfig(
  endpoint: unknown,
  websiteId: unknown
): AnalyticsScriptConfig | null {
  if (typeof endpoint !== "string" || typeof websiteId !== "string")
    return null;
  const normalizedEndpoint = endpoint.trim();
  const normalizedWebsiteId = websiteId.trim();
  if (!normalizedEndpoint || !normalizedWebsiteId) return null;

  try {
    const base = new URL(normalizedEndpoint);
    if (base.protocol !== "https:") return null;
    return {
      src: new URL("umami", `${base.href.replace(/\/+$/, "")}/`).href,
      websiteId: normalizedWebsiteId,
    };
  } catch {
    return null;
  }
}

export function installConfiguredAnalytics(
  documentRef: Document = document
): boolean {
  const config = resolveAnalyticsScriptConfig(
    import.meta.env.VITE_ANALYTICS_ENDPOINT,
    import.meta.env.VITE_ANALYTICS_WEBSITE_ID
  );
  if (
    !config ||
    documentRef.querySelector('script[data-studentos-analytics="true"]')
  )
    return false;

  const script = documentRef.createElement("script");
  script.defer = true;
  script.src = config.src;
  script.dataset.websiteId = config.websiteId;
  script.dataset.studentosAnalytics = "true";
  documentRef.head.appendChild(script);
  return true;
}
