/** Produces a request-deduplication key that is intentionally renewed after a browser reconnect. */
export function devicePushSyncKey(
  endpoint: string,
  reminderFingerprint: string,
  onlineEpoch: number
) {
  return `${endpoint}:${reminderFingerprint}:${onlineEpoch}`;
}

const LAST_REGISTERED_ENDPOINT_PREFIX = "studentos:last-push-endpoint:v1:";

export function lastRegisteredPushEndpoint(accountCacheScope: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(
      `${LAST_REGISTERED_ENDPOINT_PREFIX}${accountCacheScope}`
    );
  } catch {
    return null;
  }
}

export function rememberRegisteredPushEndpoint(
  accountCacheScope: string,
  endpoint: string
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LAST_REGISTERED_ENDPOINT_PREFIX}${accountCacheScope}`,
      endpoint
    );
  } catch {
    /* Push setup remains usable when storage is unavailable. */
  }
}
