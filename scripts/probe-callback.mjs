// Probe the production OAuth callback to inspect Set-Cookie SameSite attribute.
// Uses state encoding logic inline (base64 of JSON) to avoid TS imports.
const nonce = "test2222-3333-4444-5555-666677778888";
const state = btoa(
  JSON.stringify({
    redirectUri: "https://studentos-jmnrfmj9.manus.space/api/oauth/callback",
    nonce,
  })
);
const url =
  "https://studentos-jmnrfmj9.manus.space/api/oauth/callback?code=TEST&state=" +
  encodeURIComponent(state);
const resp = await fetch(url, {
  redirect: "manual",
  headers: { cookie: `__Host-oauth_state=${nonce}` },
  signal: AbortSignal.timeout(20000),
});
console.log("status:", resp.status);
console.log("set-cookie:", resp.headers.get("set-cookie"));
console.log("location:", resp.headers.get("location"));
