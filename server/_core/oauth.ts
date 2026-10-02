import {
  COOKIE_NAME,
  decodeOAuthState,
  OAUTH_CALLBACK_COOKIE,
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
  ONE_YEAR_MS,
} from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import * as db from "../db";
import { logOperationalFailure } from "../safeOperationalLog";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function requestOrigin(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    (Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto?.split(",")[0]
    )?.trim() || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function callbackUrl(req: Request) {
  return `${requestOrigin(req)}/api/oauth/callback`;
}

const OAUTH_TRANSACTION_MAX_AGE_MS = 30 * 60 * 1000;

function isAllowedCallbackOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "https:") return true;
    return (
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function callbackUrlFromStartRequest(req: Request) {
  const requestedCallback = req.body?.callbackUrl;
  if (typeof requestedCallback !== "string" || requestedCallback.length === 0) {
    // Compatibility fallback for an already-installed client that predates the
    // explicit callback binding. Current clients always send callbackUrl.
    return callbackUrl(req);
  }

  const origin = req.get("origin");
  if (!origin || !isAllowedCallbackOrigin(origin)) return null;

  const expectedCallback = `${origin}/api/oauth/callback`;
  return requestedCallback === expectedCallback ? requestedCallback : null;
}

function logOAuthLifecycle(
  stage: string,
  detail: Record<string, boolean | string> = {}
) {
  // Never include OAuth code/state, cookies, token values, email, or identity.
  console.info("[OAuth] Callback lifecycle", { stage, ...detail });
}

function respondOAuthError(
  req: Request,
  res: Response,
  status: number,
  code: string
) {
  if (req.accepts("html")) {
    res.redirect(303, `/?authError=${encodeURIComponent(code)}`);
    return;
  }
  res.status(status).json({ error: code });
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/oauth/start", (req: Request, res: Response) => {
    // This endpoint only mints a short-lived nonce; it does not authenticate,
    // mutate an account, or expose a session. Do not compare Origin to the
    // proxy-visible Host here: mobile webviews and reverse proxies may omit or
    // rewrite Origin/Host differently. The security boundary is the callback's
    // exact redirect binding plus cookie/nonce equality below.
    const boundCallback = callbackUrlFromStartRequest(req);
    if (!boundCallback) {
      logOAuthLifecycle("start_rejected", { validCallbackOrigin: false });
      res.status(400).json({ error: "invalid oauth callback origin" });
      return;
    }

    const nonce = crypto.randomUUID();
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    // Both cookies are host-only, HTTP-only, and Secure by construction. The
    // `__Host-` prefix requires Secure, so do not rely on reverse-proxy
    // protocol detection for this CSRF-critical transaction state.
    const transactionCookieOptions = {
      httpOnly: true,
      path: "/" as const,
      sameSite: "lax" as const,
      secure: true,
      maxAge: OAUTH_TRANSACTION_MAX_AGE_MS,
    };
    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      ...transactionCookieOptions,
    });
    res.cookie(OAUTH_CALLBACK_COOKIE, boundCallback, transactionCookieOptions);
    res.cookie(OAUTH_PKCE_COOKIE, codeVerifier, transactionCookieOptions);
    logOAuthLifecycle("start_issued", {
      callbackBound: true,
      pkceIssued: true,
    });
    res.json({ nonce, codeChallenge, codeChallengeMethod: "S256" });
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    logOAuthLifecycle("callback_received", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
    });

    if (!code || !state) {
      logOAuthLifecycle("callback_rejected_missing_parameters");
      respondOAuthError(req, res, 400, "code and state are required");
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // the server issued in the browser that began this login. The callback
    // also accepts only the exact callback URL for this host, preventing a
    // valid nonce from being replayed with an unrelated redirect target.
    const { nonce, redirectUri } = decodeOAuthState(state);
    const transactionCookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedNonce = transactionCookies[OAUTH_STATE_COOKIE];
    const expectedCallback = transactionCookies[OAUTH_CALLBACK_COOKIE];
    const expectedPkceVerifier = transactionCookies[OAUTH_PKCE_COOKIE];
    const nonceMatches = Boolean(nonce && nonce === expectedNonce);
    const callbackMatches = Boolean(
      expectedCallback && redirectUri === expectedCallback
    );
    const pkceVerifierPresent =
      typeof expectedPkceVerifier === "string" &&
      expectedPkceVerifier.length >= 32;
    if (!nonceMatches || !callbackMatches || !pkceVerifierPresent) {
      logOAuthLifecycle("callback_rejected_state", {
        nonceMatches,
        callbackMatches,
        pkceVerifierPresent,
      });
      respondOAuthError(req, res, 403, "invalid oauth state");
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, {
      path: "/",
      secure: true,
      sameSite: "lax",
    });
    res.clearCookie(OAUTH_CALLBACK_COOKIE, {
      path: "/",
      secure: true,
      sameSite: "lax",
    });
    res.clearCookie(OAUTH_PKCE_COOKIE, {
      path: "/",
      secure: true,
      sameSite: "lax",
    });
    logOAuthLifecycle("state_validated");

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(
        code,
        state,
        expectedPkceVerifier!
      );
      logOAuthLifecycle("token_exchanged");
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.subject) {
        logOAuthLifecycle("callback_rejected_missing_identity");
        respondOAuthError(req, res, 400, "subject missing from user info");
        return;
      }

      await db.upsertUser({
        openId: userInfo.subject,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      logOAuthLifecycle("user_persisted");

      const sessionToken = await sdk.createSessionToken(userInfo.subject, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      logOAuthLifecycle("session_cookie_issued", {
        secure: Boolean(cookieOptions.secure),
        sameSite: String(cookieOptions.sameSite),
      });

      logOAuthLifecycle("redirect_started");
      res.redirect(302, "/");
    } catch (error) {
      logOperationalFailure("OAuth", "Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
