import { encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Student OS OAuth login. The server issues the one-time nonce and sets
// its host-only cookie. This avoids mobile browsers dropping a client-written
// Secure/SameSite cookie before the OAuth provider redirects back.
export const startLogin = async (provider?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  try {
    const response = await fetch("/api/oauth/start", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ callbackUrl: redirectUri }),
    });
    if (!response.ok)
      throw new Error(`OAuth start failed (${response.status})`);
    const payload: unknown = await response.json();
    const nonce =
      payload &&
      typeof payload === "object" &&
      "nonce" in payload &&
      typeof payload.nonce === "string"
        ? payload.nonce
        : "";
    if (!nonce) throw new Error("OAuth start returned no nonce");

    const state = encodeOAuthState({ redirectUri, nonce });
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    const challenge =
      payload &&
      typeof payload === "object" &&
      "codeChallenge" in payload &&
      typeof payload.codeChallenge === "string"
        ? payload.codeChallenge
        : "";
    const challengeMethod =
      payload &&
      typeof payload === "object" &&
      "codeChallengeMethod" in payload &&
      payload.codeChallengeMethod === "S256"
        ? "S256"
        : "";
    if (!challenge || !challengeMethod)
      throw new Error("OAuth start returned no PKCE challenge");
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", challengeMethod);
    if (provider) url.searchParams.set("provider", provider);

    window.location.href = url.toString();
    return true;
  } catch (error) {
    console.warn("Unable to start Student OS sign-in", error);
    return false;
  }
};
