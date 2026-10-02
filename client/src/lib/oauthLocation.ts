/**
 * Returns a same-origin replacement path after removing a stale OAuth failure
 * indicator. Call this only once authenticated identity has been verified.
 */
export function getAuthenticatedLocationWithoutOAuthError(href: string) {
  const url = new URL(href);
  if (!url.searchParams.has("authError")) return null;

  url.searchParams.delete("authError");
  return `${url.pathname}${url.search}${url.hash}`;
}
