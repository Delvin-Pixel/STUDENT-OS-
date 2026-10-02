import { ForbiddenError } from "@shared/_core/errors";
import {
  AXIOS_TIMEOUT_MS,
  COOKIE_NAME,
  ONE_YEAR_MS,
  decodeOAuthState,
} from "@shared/const";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { logOperationalFailure } from "../safeOperationalLog";
import { ENV } from "./env";
import type {
  GetAuthenticatedIdentityRequest,
  GetAuthenticatedIdentityResponse,
  OAuthTokenExchangeRequest,
  OAuthTokenResponse,
  UserInfoResponse,
} from "./types/authTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  subject: string;
  appId: string;
  name: string;
};

export function isValidSessionPayload(
  payload: unknown,
  expectedAppId?: string
): payload is SessionPayload {
  if (!payload || typeof payload !== "object") return false;
  const { subject, appId, name } = payload as Record<string, unknown>;
  return (
    isNonEmptyString(subject) &&
    isNonEmptyString(appId) &&
    typeof name === "string" &&
    (expectedAppId === undefined || appId === expectedAppId)
  );
}

export function assertOAuthUserMatchesSession(
  sessionSubject: string,
  oauthSubject: string
) {
  if (sessionSubject !== oauthSubject) {
    throw ForbiddenError(
      "OAuth identity did not match the verified Student OS session"
    );
  }
}

const EXCHANGE_TOKEN_PATH = process.env.OAUTH_TOKEN_PATH ?? "/oauth/token";
const GET_USER_INFO_PATH = process.env.OAUTH_USERINFO_PATH ?? "/oauth/userinfo";
const GET_USER_INFO_WITH_JWT_PATH =
  process.env.OAUTH_IDENTITY_PATH ?? "/oauth/identity";

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }

  private decodeState(state: string): string {
    return decodeOAuthState(state).redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string,
    codeVerifier: string
  ): Promise<OAuthTokenResponse> {
    const payload: OAuthTokenExchangeRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
      codeVerifier,
    };

    const { data } = await this.client.post<OAuthTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: OAuthTokenResponse
  ): Promise<UserInfoResponse> {
    const { data } = await this.client.post<UserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

export class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string,
    codeVerifier: string
  ): Promise<OAuthTokenResponse> {
    return this.oauthService.getTokenByCode(code, state, codeVerifier);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<UserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as OAuthTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as UserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return validatedSessionSecret(ENV.cookieSecret);
  }

  /**
   * Create a session token for an authenticated external subject
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.subject);
   */
  async createSessionToken(
    subject: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        subject,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      subject: payload.subject,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { subject, appId, name } = payload as Record<string, unknown>;
      const sessionPayload = { subject, appId, name };

      if (!isValidSessionPayload(sessionPayload, ENV.appId)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return sessionPayload;
    } catch (error) {
      logOperationalFailure("Auth", "Session verification failed", error);
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetAuthenticatedIdentityResponse> {
    const payload: GetAuthenticatedIdentityRequest = {
      jwtToken,
      clientId: ENV.appId,
    };

    const { data } = await this.client.post<GetAuthenticatedIdentityResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetAuthenticatedIdentityResponse;
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    // Student OS accepts only its signed cookie. Session tokens must never be
    // accepted through a browser-readable Authorization fallback.
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionToken = cookies.get(COOKIE_NAME);

    const session = await this.verifySession(sessionToken);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    if (session.subject.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }

    const sessionUserId = session.subject;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        assertOAuthUserMatchesSession(sessionUserId, userInfo.subject);
        await db.upsertUser({
          openId: userInfo.subject,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.subject);
      } catch (error) {
        logOperationalFailure("Auth", "OAuth user sync failed", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

const CRON_OPEN_ID_PREFIX = "cron_";

/** Refuse insecure startup configuration rather than signing cookies with an empty or weak secret. */
export function validatedSessionSecret(secret: string) {
  const normalized = secret.trim();
  const secretByteLength = new TextEncoder().encode(normalized).byteLength;
  // The managed runtime provisions a high-entropy session secret that is 22
  // bytes long. Retain a 128-bit minimum input-secret requirement, then derive
  // a fixed 256-bit HMAC key rather than rejecting that secure platform value.
  if (secretByteLength < 16) {
    throw new Error("Student OS session security configuration is invalid.");
  }
  return new Uint8Array(
    createHash("sha256")
      .update("student-os/session-signing/v1\0", "utf8")
      .update(normalized, "utf8")
      .digest()
  );
}

/** Result of `sdk.authenticateRequest`. Cron callbacks set `isCron=true` and `taskUid`; see `/home/ubuntu/skills/webdev-periodic-updates/SKILL.md`. */
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

function buildCronUser(
  userInfo: GetAuthenticatedIdentityResponse
): AuthenticatedUser {
  const now = new Date();
  return {
    id: -1,
    openId: userInfo.subject,
    name: userInfo.name || "Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? undefined,
    isCron: true,
  } as AuthenticatedUser;
}

export const sdk = new SDKServer();
