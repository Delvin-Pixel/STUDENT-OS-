// Simulate the exact browser sign-in flow against production:
// 1. The page sets the __Host-oauth_state cookie via document.cookie (SameSite=Lax; Secure)
// 2. startLogin navigates to the OAuth portal; the portal redirects back to
//    /api/oauth/callback?code=REAL&state=... with top-level navigation.
// 3. The browser attaches the __Host-oauth_state cookie on that GET request.
// We can't mint a real code, but we can check:
// - which branch the callback takes with/without the matching cookie
// - what Set-Cookie attributes the session cookie WOULD have (by triggering
//   the guard branch which clears the nonce cookie)
// - importantly: whether a 5xx/4xx response path shows a visible error
const BASE = "https://studentos-jmnrfmj9.manus.space";

const stateFor = nonce =>
  encodeURIComponent(
    btoa(JSON.stringify({ redirectUri: `${BASE}/api/oauth/callback`, nonce }))
  );

const call = async (nonce, opts = {}) => {
  const url = `${BASE}/api/oauth/callback?code=${opts.code || "TEST"}&state=${stateFor(nonce)}`;
  const headers = {};
  if (nonce) headers.cookie = `__Host-oauth_state=${nonce}`;
  const resp = await fetch(url, {
    redirect: "manual",
    headers,
    signal: AbortSignal.timeout(20000),
  });
  console.log("status:", resp.status);
  console.log("location-present:", Boolean(resp.headers.get("location")));
  console.log("set-cookie-present:", Boolean(resp.headers.get("set-cookie")));
  const body = await resp.text().catch(() => "");
  console.log("body-length:", body.length);
  console.log("---");
};

console.log("1) No nonce cookie (guard branch):");
await call(null);

console.log("2) Matching nonce cookie, fake code (exchange fails path):");
await call("e2e-" + crypto.randomUUID());
